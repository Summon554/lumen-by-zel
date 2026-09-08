/** Lumen voice/video calling: WebRTC peer connection + Supabase realtime signalling. */
import { supabase } from "@/integrations/supabase/client";

export type CallKind = "audio" | "video";
export type CallStatus = "ringing" | "accepted" | "declined" | "missed" | "ended";

export type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  kind: CallKind;
  status: CallStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type OutgoingCallRequest = {
  otherId: string;
  kind: CallKind;
  name?: string | null;
  avatar?: string | null;
};

const START_EVENT = "lumen:start-call";

/** Ask the globally-mounted call overlay to place a call. */
export function requestCall(req: OutgoingCallRequest) {
  window.dispatchEvent(new CustomEvent<OutgoingCallRequest>(START_EVENT, { detail: req }));
}

export function onCallRequest(handler: (req: OutgoingCallRequest) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<OutgoingCallRequest>).detail);
  window.addEventListener(START_EVENT, listener);
  return () => window.removeEventListener(START_EVENT, listener);
}

/** Deterministic signalling channel name shared by both participants. */
export function signalChannelName(a: string, b: string) {
  return `call-${[a, b].sort().join("-")}`;
}

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export function createPeer() {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

export async function getLocalStream(kind: CallKind) {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: kind === "video" ? { facingMode: "user", width: { ideal: 1280 } } : false,
  });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}m ${rest.toString().padStart(2, "0")}s`;
}

export function callLogText(kind: CallKind, status: CallStatus, seconds: number) {
  const label = kind === "video" ? "Video call" : "Voice call";
  if (status === "declined") return `📞 ${label} declined`;
  if (status === "missed") return `📞 Missed ${label.toLowerCase()}`;
  return `📞 ${label} · ${formatDuration(seconds)}`;
}

/** Writes a short call summary into the chat thread. */
export async function logCallMessage(
  meId: string,
  otherId: string,
  kind: CallKind,
  status: CallStatus,
  seconds: number,
) {
  await (supabase as any).from("messages").insert({
    sender_id: meId,
    receiver_id: otherId,
    content: callLogText(kind, status, seconds),
    quote_kind: "call",
  });
}
