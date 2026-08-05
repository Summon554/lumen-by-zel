import { useState } from "react";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ReportableType = "post" | "comment" | "message" | "story" | "note" | "profile";

const REASONS = [
  "Spam",
  "Harassment or bullying",
  "Hate speech",
  "Violence or threats",
  "Inappropriate content",
  "Impersonation",
  "Copyright",
  "Other",
];

/**
 * Universal report control. Works for every content type; reported items are
 * held from auto-deletion until a moderator resolves the report.
 */
export function ReportButton({
  meId,
  contentType,
  contentId,
  authorId,
  label,
  className,
}: {
  meId: string | null;
  contentType: ReportableType;
  contentId?: string;
  authorId?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (!meId || (authorId && authorId === meId)) return null;

  async function submit() {
    setBusy(true);
    const { error } = await (supabase as any).from("reports").insert({
      reporter_id: meId,
      reported_user_id: authorId ?? null,
      post_id: contentType === "post" ? contentId ?? null : null,
      content_type: contentType,
      content_id: contentId ?? null,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    setDetails("");
    toast.success("Thanks — this is now with our moderators and won't be auto-deleted until reviewed.");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
        }
        aria-label={`Report ${contentType}`}
      >
        <Flag size={13} /> {label ?? "Report"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-foreground/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xl">
            <h2 className="text-base font-semibold">Report this {contentType}</h2>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Anything else we should know? (optional)"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={submit}
                className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                style={{ background: "var(--gradient-glow)" }}
              >
                Send report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}