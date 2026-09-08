import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { LumenAvatar } from "@/components/LumenAvatar";
import { toast } from "sonner";
import {
  createPeer,
  formatDuration,
  getLocalStream,
  logCallMessage,
  onCallRequest,
  signalChannelName,
  stopStream,
  type CallKind,
  type CallRow,
} from "@/lib/calls";

type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "in-call";

type Peer = { id: string; name: string | null; avatar: string | null };

const RING_TIMEOUT_MS = 35000;

/** Mounted once at the app root so a call can arrive on any page. */
export function CallOverlay() {
  const [me, setMe] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [kind, setKind] = useState<CallKind>("audio");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isCaller, setIsCaller] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const signal = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number | null>(null);
  const ring = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);
  const stateRef = useRef({ callId: null as string | null, peerId: null as string | null, kind: "audio" as CallKind, isCaller: false });

  useEffect(() => {
    stateRef.current = { callId, peerId: peer?.id ?? null, kind, isCaller };
  }, [callId, peer, kind, isCaller]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  // ---- ringtone -------------------------------------------------------
  const startRing = useCallback(() => {
    if (ring.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      let stopped = false;
      const beep = () => {
        if (stopped) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 620;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      };
      beep();
      const iv = setInterval(beep, 1400);
      ring.current = {
        ctx,
        stop: () => {
          stopped = true;
          clearInterval(iv);
          ctx.close().catch(() => {});
        },
      };
    } catch {
      /* audio not available */
    }
  }, []);

  const stopRing = useCallback(() => {
    ring.current?.stop();
    ring.current = null;
  }, []);

  // ---- teardown -------------------------------------------------------
  const cleanup = useCallback(() => {
    stopRing();
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = null;
    pc.current?.getSenders().forEach((s) => s.track?.stop());
    pc.current?.close();
    pc.current = null;
    stopStream(localStream.current);
    localStream.current = null;
    if (signal.current) supabase.removeChannel(signal.current);
    signal.current = null;
    startedAt.current = null;
    setSeconds(0);
    setMuted(false);
    setCamOff(false);
    setPhase("idle");
    setCallId(null);
    setPeer(null);
    setIsCaller(false);
  }, [stopRing]);

  useEffect(() => cleanup, [cleanup]);

  // ---- call duration timer -------------------------------------------
  useEffect(() => {
    if (phase !== "in-call") return;
    const iv = setInterval(() => {
      if (startedAt.current) setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  const attachStreams = useCallback((stream: MediaStream) => {
    localStream.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
  }, []);

  const buildPeer = useCallback(
    (channel: ReturnType<typeof supabase.channel>, meId: string) => {
      const conn = createPeer();
      conn.onicecandidate = (e) => {
        if (e.candidate)
          channel.send({
            type: "broadcast",
            event: "ice",
            payload: { from: meId, candidate: e.candidate.toJSON() },
          });
      };
      conn.ontrack = (e) => {
        const [stream] = e.streams;
        if (!stream) return;
        if (remoteVideo.current) remoteVideo.current.srcObject = stream;
        if (remoteAudio.current) remoteAudio.current.srcObject = stream;
        setPhase("in-call");
        if (!startedAt.current) startedAt.current = Date.now();
        stopRing();
      };
      conn.onconnectionstatechange = () => {
        if (conn.connectionState === "failed") {
          toast.error("Call could not connect on this network");
          endCall("ended");
        }
      };
      pc.current = conn;
      return conn;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopRing],
  );

  const endCall = useCallback(
    async (status: "ended" | "declined" | "missed") => {
      const { callId: cid, peerId, kind: k, isCaller: caller } = stateRef.current;
      const secs = startedAt.current ? Math.floor((Date.now() - startedAt.current) / 1000) : 0;
      signal.current?.send({ type: "broadcast", event: "hangup", payload: { callId: cid } });
      if (cid) {
        await (supabase as any)
          .from("calls")
          .update({ status, ended_at: new Date().toISOString() })
          .eq("id", cid);
      }
      if (caller && me && peerId) {
        await logCallMessage(me, peerId, k, status === "ended" && secs === 0 ? "missed" : status, secs);
      }
      cleanup();
    },
    [cleanup, me],
  );

  // ---- outgoing -------------------------------------------------------
  useEffect(() => {
    if (!me) return;
    return onCallRequest(async (req) => {
      if (phase !== "idle") {
        toast.error("You are already on a call");
        return;
      }
      try {
        const stream = await getLocalStream(req.kind);
        attachStreams(stream);
        const { data, error } = await (supabase as any)
          .from("calls")
          .insert({ caller_id: me, callee_id: req.otherId, kind: req.kind })
          .select("*")
          .maybeSingle();
        if (error) throw error;
        const row = data as CallRow;
        setCallId(row.id);
        setKind(req.kind);
        setIsCaller(true);
        setPeer({ id: req.otherId, name: req.name ?? null, avatar: req.avatar ?? null });
        setPhase("outgoing");
        stateRef.current = { callId: row.id, peerId: req.otherId, kind: req.kind, isCaller: true };
        startRing();

        const channel = supabase.channel(signalChannelName(me, req.otherId), {
          config: { broadcast: { self: false } },
        });
        signal.current = channel;
        const conn = buildPeer(channel, me);
        stream.getTracks().forEach((t) => conn.addTrack(t, stream));

        channel
          .on("broadcast", { event: "ready" }, async (p) => {
            if ((p.payload as any)?.callId !== row.id) return;
            stopRing();
            setPhase("connecting");
            const offer = await conn.createOffer();
            await conn.setLocalDescription(offer);
            channel.send({ type: "broadcast", event: "offer", payload: { callId: row.id, sdp: offer } });
          })
          .on("broadcast", { event: "answer" }, async (p) => {
            const sdp = (p.payload as any)?.sdp;
            if (!sdp || conn.currentRemoteDescription) return;
            await conn.setRemoteDescription(new RTCSessionDescription(sdp));
          })
          .on("broadcast", { event: "ice" }, async (p) => {
            const c = (p.payload as any)?.candidate;
            if (c) await conn.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          })
          .on("broadcast", { event: "hangup" }, () => {
            toast("Call ended");
            endCall("ended");
          })
          .subscribe();

        ringTimer.current = setTimeout(() => {
          if (!startedAt.current) {
            toast("No answer");
            endCall("missed");
          }
        }, RING_TIMEOUT_MS);
      } catch (err) {
        stopStream(localStream.current);
        localStream.current = null;
        toast.error(err instanceof Error ? err.message : "Could not start the call");
        cleanup();
      }
    });
  }, [me, phase, attachStreams, buildPeer, startRing, stopRing, endCall, cleanup]);

  // ---- incoming -------------------------------------------------------
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`incoming-calls-${me}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${me}` },
        async (payload) => {
          const row = payload.new as CallRow;
          if (row.status !== "ringing") return;
          if (stateRef.current.callId) return;
          const { data: prof } = await supabase
            .from("profiles")
            .select("name,avatar_url")
            .eq("id", row.caller_id)
            .maybeSingle();
          setCallId(row.id);
          setKind(row.kind);
          setIsCaller(false);
          setPeer({
            id: row.caller_id,
            name: prof?.name ?? null,
            avatar: prof?.avatar_url ? await getSignedUrl(prof.avatar_url) : null,
          });
          setPhase("incoming");
          startRing();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `caller_id=eq.${me}` },
        (payload) => {
          const row = payload.new as CallRow;
          if (row.id !== stateRef.current.callId) return;
          if (row.status === "declined") {
            toast("Call declined");
            cleanup();
            if (me && stateRef.current.peerId)
              logCallMessage(me, stateRef.current.peerId, stateRef.current.kind, "declined", 0);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, startRing, cleanup]);

  async function accept() {
    if (!me || !peer || !callId) return;
    stopRing();
    try {
      const stream = await getLocalStream(kind);
      attachStreams(stream);
      setPhase("connecting");
      await (supabase as any)
        .from("calls")
        .update({ status: "accepted", started_at: new Date().toISOString() })
        .eq("id", callId);

      const channel = supabase.channel(signalChannelName(me, peer.id), {
        config: { broadcast: { self: false } },
      });
      signal.current = channel;
      const conn = buildPeer(channel, me);
      stream.getTracks().forEach((t) => conn.addTrack(t, stream));

      channel
        .on("broadcast", { event: "offer" }, async (p) => {
          const sdp = (p.payload as any)?.sdp;
          if (!sdp) return;
          await conn.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await conn.createAnswer();
          await conn.setLocalDescription(answer);
          channel.send({ type: "broadcast", event: "answer", payload: { callId, sdp: answer } });
        })
        .on("broadcast", { event: "ice" }, async (p) => {
          const c = (p.payload as any)?.candidate;
          if (c) await conn.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        })
        .on("broadcast", { event: "hangup" }, () => {
          toast("Call ended");
          cleanup();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") channel.send({ type: "broadcast", event: "ready", payload: { callId } });
        });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join the call");
      await endCall("declined");
    }
  }

  function toggleMute() {
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  function toggleCam() {
    const track = localStream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOff(!track.enabled);
  }

  if (phase === "idle" || typeof document === "undefined") return null;

  const showVideo = kind === "video";
  const title =
    phase === "incoming"
      ? `Incoming ${showVideo ? "video" : "voice"} call`
      : phase === "outgoing"
        ? "Ringing…"
        : phase === "connecting"
          ? "Connecting…"
          : formatDuration(seconds);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background/95 backdrop-blur-xl px-6 py-10">
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <LumenAvatar name={peer?.name} url={peer?.avatar} size={96} />
        <p className="text-lg font-semibold">{peer?.name || "Lumen friend"}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>

      {showVideo && (
        <div className="relative my-4 w-full max-w-md flex-1 overflow-hidden rounded-3xl border border-border bg-card">
          <video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-cover" />
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            className="absolute bottom-3 right-3 h-32 w-24 rounded-2xl border border-border object-cover"
          />
        </div>
      )}

      <div className="flex items-center gap-4 pb-6">
        {phase === "incoming" ? (
          <>
            <button
              onClick={() => endCall("declined")}
              className="h-14 w-14 grid place-items-center rounded-full bg-destructive text-destructive-foreground"
              aria-label="Decline call"
            >
              <PhoneOff size={22} />
            </button>
            <button
              onClick={accept}
              className="h-14 w-14 grid place-items-center rounded-full text-primary-foreground"
              style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
              aria-label="Accept call"
            >
              <Phone size={22} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className="h-12 w-12 grid place-items-center rounded-full border border-border bg-card"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            {showVideo && (
              <button
                onClick={toggleCam}
                className="h-12 w-12 grid place-items-center rounded-full border border-border bg-card"
                aria-label={camOff ? "Turn camera on" : "Turn camera off"}
              >
                {camOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
            )}
            <button
              onClick={() => endCall("ended")}
              className="h-14 w-14 grid place-items-center rounded-full bg-destructive text-destructive-foreground"
              aria-label="Hang up"
            >
              <PhoneOff size={22} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
