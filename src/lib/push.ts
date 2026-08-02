import { supabase } from "@/integrations/supabase/client";

export type NotificationPrefs = {
  user_id: string;
  messages: boolean;
  reactions: boolean;
  follows: boolean;
  quiet_hours: boolean;
  permission_asked: boolean;
};

const DEVICE_KEY = "lumen.device.id";

export function isQuietHours(d = new Date()) {
  const h = d.getHours();
  return h >= 22 || h < 6;
}

export function browserPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function loadPrefs(userId: string): Promise<NotificationPrefs> {
  const { data } = await (supabase as any)
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as NotificationPrefs;
  const fresh = {
    user_id: userId,
    messages: true,
    reactions: true,
    follows: true,
    quiet_hours: true,
    permission_asked: false,
  };
  await (supabase as any).from("notification_prefs").insert(fresh);
  return fresh;
}

export async function savePrefs(userId: string, patch: Partial<NotificationPrefs>) {
  await (supabase as any).from("notification_prefs").update(patch).eq("user_id", userId);
}

/** Device identifiers are hashed before they ever leave the browser. */
async function hashedDeviceToken(): Promise<string> {
  let raw = localStorage.getItem(DEVICE_KEY);
  if (!raw) {
    raw = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, raw);
  }
  const bytes = new TextEncoder().encode(`lumen:${raw}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function registerDevice(userId: string) {
  try {
    const token = await hashedDeviceToken();
    await (supabase as any)
      .from("device_tokens")
      .upsert({ user_id: userId, token, platform: "web" }, { onConflict: "user_id,token" });
  } catch {
    /* non-fatal */
  }
}

export async function requestPermission(userId: string): Promise<NotificationPermission | "unsupported"> {
  if (browserPermission() === "unsupported") return "unsupported";
  const result = await Notification.requestPermission();
  await savePrefs(userId, { permission_asked: true });
  if (result === "granted") await registerDevice(userId);
  return result;
}

export async function showLocalNotification(opts: { title: string; body: string; url?: string; tag?: string }) {
  if (browserPermission() !== "granted") return;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: opts.tag,
    });
    n.onclick = () => {
      window.focus();
      if (opts.url) window.location.assign(opts.url);
      n.close();
    };
  } catch {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.showNotification(opts.title, {
        body: opts.body,
        icon: "/icons/icon-192.png",
        tag: opts.tag,
        data: { url: opts.url },
      });
    } catch {
      /* ignore */
    }
  }
}

export function shouldSend(
  prefs: NotificationPrefs | null,
  kind: "messages" | "reactions" | "follows",
  opts: { activeUrl?: string; targetUrl?: string } = {},
) {
  if (!prefs || !prefs[kind]) return false;
  if (prefs.quiet_hours && isQuietHours()) return false;
  if (browserPermission() !== "granted") return false;
  // Already looking at it? Stay quiet.
  if (typeof document !== "undefined" && !document.hidden) {
    if (opts.activeUrl && opts.targetUrl && opts.activeUrl === opts.targetUrl) return false;
  }
  return true;
}