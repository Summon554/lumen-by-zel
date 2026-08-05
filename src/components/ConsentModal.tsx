import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { pendingConsents, recordConsents } from "@/lib/consent";
import { INDEPENDENCE_DISCLAIMER, LEGAL_VERSIONS, type DocKind } from "@/lib/legal";

/**
 * Data Privacy Act (RA 10173) consent gate. Shown on first sign-in / first post
 * and again whenever a legal document version changes.
 */
export function ConsentModal({ userId }: { userId: string | null }) {
  const [pending, setPending] = useState<DocKind[]>([]);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    pendingConsents(userId).then(setPending);
  }, [userId]);

  if (!userId || pending.length === 0) return null;

  const reconsent = pending.length < Object.keys(LEGAL_VERSIONS).length;

  async function accept() {
    setBusy(true);
    const { error } = (await recordConsents(userId!, pending)) as { error: { message: string } | null };
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPending([]);
    toast.success("Thank you — your consent is recorded.");
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full grid place-items-center text-primary-foreground shrink-0"
            style={{ background: "var(--gradient-glow)" }}
          >
            <ShieldCheck size={18} />
          </div>
          <h2 className="text-lg font-semibold">
            {reconsent ? "Our terms have been updated" : "Before you share"}
          </h2>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Lumen stores your name, email, and anything you choose to post so the app can work. We
            never sell your data or hand it to advertisers.
          </p>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>You can download a copy of everything you've shared at any time.</li>
            <li>You can delete your account, with 7 days to change your mind.</li>
            <li>You may withdraw consent by deleting your account.</li>
          </ul>
          <p className="text-xs">
            This is your right under the Philippine Data Privacy Act of 2012 (RA 10173).
          </p>
          <p className="text-xs italic">{INDEPENDENCE_DISCLAIMER}</p>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary shrink-0"
          />
          <span>
            I have read and agree to the{" "}
            <Link to="/privacy" className="text-primary underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="text-primary underline underline-offset-4">
              Terms of Service
            </Link>
            , and I consent to Lumen processing my personal data as described.
          </span>
        </label>

        <button
          disabled={!checked || busy}
          onClick={accept}
          className="w-full rounded-full py-3 text-sm font-medium text-primary-foreground transition disabled:opacity-50"
          style={{ background: "var(--gradient-glow)" }}
        >
          {busy ? "Saving…" : "I agree"}
        </button>
      </div>
    </div>
  );
}