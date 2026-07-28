// Guarded PWA registration wrapper. Never registers in dev, Lovable preview,
// or when ?sw=off is present. Exposes an update callback for the UI banner.
// @ts-expect-error - virtual module provided by vite-plugin-pwa at build time
import { registerSW } from "virtual:pwa-register";

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return true;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
        return url.endsWith(SW_URL);
      })
      .map((r) => r.unregister()),
  );
}

export type UpdateHandlers = {
  onNeedRefresh: (updateFn: () => Promise<void>) => void;
  onOfflineReady?: () => void;
};

export function setupPWA(handlers: UpdateHandlers) {
  if (isRefusedContext()) {
    void unregisterMatching();
    return;
  }
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      handlers.onNeedRefresh(async () => {
        await updateSW(true);
      });
    },
    onOfflineReady() {
      handlers.onOfflineReady?.();
    },
  });
}