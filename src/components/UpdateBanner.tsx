import { useEffect, useState } from "react";
import { setupPWA } from "@/lib/register-sw";

export function UpdateBanner() {
  const [update, setUpdate] = useState<null | (() => Promise<void>)>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setupPWA({
      onNeedRefresh: (fn) => setUpdate(() => fn),
    });
  }, []);

  if (!update) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-50 px-3 pt-3 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto max-w-lg mx-auto rounded-2xl border border-border bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-3 shadow-lg"
        style={{ boxShadow: "var(--shadow-glow)" }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">New Update Available</p>
          <p className="text-xs text-muted-foreground">Reload to get the latest Lumen.</p>
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await update();
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-full px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-glow)" }}
        >
          {busy ? "Updating…" : "Update Now"}
        </button>
      </div>
    </div>
  );
}