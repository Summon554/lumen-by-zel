import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startPresenceHeartbeat } from "@/lib/presence";
import {
  browserPermission,
  loadPrefs,
  registerDevice,
  requestPermission,
  savePrefs,
  shouldSend,
  showLocalNotification,
  type NotificationPrefs,
} from "@/lib/push";
import { emojiFor } from "@/lib/reactions";
import { Bell } from "lucide-react";

/**
 * Mounted once at the root: presence heartbeat, the first-login notification
 * permission prompt, and live push notifications for messages / reactions /
 * follows / shares (respecting per-user toggles and quiet hours).
 */
export function LumenNotifier() {
  const [meId, setMeId] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const prefsRef = useRef<NotificationPrefs | null>(null);

  useEffect(() => {
    let stopHeartbeat: (() => void) | undefined;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || cancelled) return;
      setMeId(user.id);
      stopHeartbeat = startPresenceHeartbeat(user.id);

      const prefs = await loadPrefs(user.id);
      prefsRef.current = prefs;
      const perm = browserPermission();
      if (perm === "granted") void registerDevice(user.id);
      if (perm === "default" && !prefs.permission_asked) setAsk(true);

      channel = supabase
        .channel(`lumen-notify-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
          async (payload) => {
            const m = payload.new as { sender_id: string; content: string };
            const targetUrl = `/messages/${m.sender_id}`;
            if (!shouldSend(prefsRef.current, "messages", { activeUrl: window.location.pathname, targetUrl })) return;
            const name = await nameOf(m.sender_id);
            void showLocalNotification({
              title: `${name} sent you a message`,
              body: (m.content || "Attachment").slice(0, 120),
              url: targetUrl,
              tag: `msg-${m.sender_id}`,
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          async (payload) => {
            const n = payload.new as { actor_id: string; type: string; post_id: string | null };
            const kind =
              n.type === "follow" || n.type === "follow_request"
                ? "follows"
                : n.type === "reaction" || n.type === "like" || n.type === "share"
                  ? "reactions"
                  : null;
            if (!kind) return;
            const targetUrl = "/notifications";
            if (!shouldSend(prefsRef.current, kind, { activeUrl: window.location.pathname, targetUrl })) return;
            const name = await nameOf(n.actor_id);
            const body =
              n.type === "share"
                ? `${name} shared your post`
                : n.type === "reaction"
                  ? `${name} reacted ${emojiFor((payload.new as any).reaction_type)} to your post`
                  : n.type === "like"
                    ? `${name} liked your post`
                    : `${name} started following you`;
            void showLocalNotification({ title: "Lumen", body, url: targetUrl, tag: `${n.type}-${n.actor_id}` });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      stopHeartbeat?.();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (!ask || !meId) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xl">
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-full grid place-items-center text-primary-foreground"
            style={{ background: "var(--gradient-glow)" }}
          >
            <Bell size={16} />
          </div>
          <h2 className="text-base font-semibold">Stay in the glow</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Lumen would like to send notifications for Messages and Mentions. Allow?
        </p>
        <p className="text-xs text-muted-foreground">
          We never send between 10PM and 6AM, and you can change this any time in Profile → Notifications.{" "}
          <a href="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </a>
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={async () => {
              await savePrefs(meId, { permission_asked: true, messages: false, reactions: false, follows: false });
              if (prefsRef.current) prefsRef.current = { ...prefsRef.current, messages: false, reactions: false, follows: false };
              setAsk(false);
            }}
            className="flex-1 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition"
          >
            Deny
          </button>
          <button
            onClick={async () => {
              await requestPermission(meId);
              setAsk(false);
            }}
            className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-primary-foreground"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

const nameCache = new Map<string, string>();
async function nameOf(id: string) {
  if (nameCache.has(id)) return nameCache.get(id)!;
  const { data } = await supabase.from("profiles").select("name").eq("id", id).maybeSingle();
  const name = data?.name || "Someone";
  nameCache.set(id, name);
  return name;
}