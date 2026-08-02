import { supabase } from "@/integrations/supabase/client";

export function isOnline(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
}

export function lastSeenLabel(lastSeen: string | null | undefined) {
  if (!lastSeen) return "Offline";
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 2 * 60 * 1000) return "Online";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days}d ago`;
}

/** Heartbeat: keeps the current user's last_seen_at fresh while the tab is open. */
export function startPresenceHeartbeat(userId: string) {
  const beat = async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    await (supabase as any).from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
  };
  void beat();
  const timer = setInterval(beat, 60_000);
  return () => clearInterval(timer);
}
