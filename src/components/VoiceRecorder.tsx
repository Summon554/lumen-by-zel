import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { toast } from "sonner";

const MAX_SECONDS = 120;

/** Tap to record a voice memo; shows a live waveform + timer, then hands back an audio File. */
export function VoiceRecorder({ onRecorded, disabled }: { onRecorded: (f: File) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0.1));
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  function cleanup() {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (timer.current) clearInterval(timer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setRecording(false);
    setSecs(0);
  }

  useEffect(() => () => cleanup(), []);

  async function start() {
    if (typeof MediaRecorder === "undefined") return toast.error("Voice memos aren't supported on this browser");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      cancelled.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        cleanup();
        if (cancelled.current || blob.size < 1000) return;
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        onRecorded(new File([blob], `voice-memo.${ext}`, { type: type.split(";")[0] }));
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevels(Array.from({ length: 16 }, (_, i) => Math.max(0.1, (data[i] ?? 0) / 255)));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      const t0 = Date.now();
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        setSecs(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      toast.error("Microphone access was blocked");
      cleanup();
    }
  }

  function stop(cancel = false) {
    cancelled.current = cancel;
    if (recRef.current?.state === "recording") recRef.current.stop();
    else cleanup();
  }

  if (!recording)
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label="Record voice memo"
        className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent text-muted-foreground disabled:opacity-50"
      >
        <Mic size={16} />
      </button>
    );

  return (
    <div className="absolute inset-0 z-10 flex items-center gap-2 rounded-full bg-card border border-border px-2">
      <button type="button" onClick={() => stop(true)} aria-label="Cancel recording" className="h-8 w-8 grid place-items-center rounded-full hover:bg-accent text-muted-foreground">
        <X size={15} />
      </button>
      <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
      <span className="text-xs tabular-nums w-10">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
      </span>
      <div className="flex-1 flex items-center gap-[3px] h-6">
        {levels.map((l, i) => (
          <span key={i} className="flex-1 rounded-full bg-primary" style={{ height: `${Math.round(l * 100)}%` }} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => stop(false)}
        aria-label="Stop and send"
        className="h-8 w-8 grid place-items-center rounded-full text-primary-foreground"
        style={{ background: "var(--gradient-glow)" }}
      >
        <Square size={13} />
      </button>
    </div>
  );
}
