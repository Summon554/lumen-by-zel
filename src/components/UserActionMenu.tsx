import { useState } from "react";
import { MoreHorizontal, Ban, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REASONS = ["Spam", "Harassment", "Inappropriate content", "Impersonation", "Other"];

export function UserActionMenu({
  meId,
  targetUserId,
  postId,
  blocked,
  onBlockedChange,
  align = "right",
}: {
  meId: string | null;
  targetUserId: string;
  postId?: string;
  blocked?: boolean;
  onBlockedChange?: (blocked: boolean) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (!meId || meId === targetUserId) return null;

  async function toggleBlock() {
    setBusy(true);
    if (blocked) {
      const { error } = await (supabase as any)
        .from("blocks")
        .delete()
        .eq("blocker_id", meId)
        .eq("blocked_id", targetUserId);
      if (error) toast.error(error.message);
      else {
        onBlockedChange?.(false);
        toast.success("Unblocked");
      }
    } else {
      const { error } = await (supabase as any)
        .from("blocks")
        .insert({ blocker_id: meId, blocked_id: targetUserId });
      if (error) toast.error(error.message);
      else {
        onBlockedChange?.(true);
        toast.success("Blocked. They can no longer message, comment, or follow you.");
      }
    }
    setBusy(false);
    setOpen(false);
  }

  async function submitReport() {
    setBusy(true);
    const { error } = await (supabase as any).from("reports").insert({
      reporter_id: meId,
      reported_user_id: targetUserId,
      post_id: postId ?? null,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Thanks — your report was sent.");
      setReporting(false);
      setDetails("");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition"
        aria-label="More options"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute z-40 mt-1 w-52 rounded-xl border border-border bg-card p-1 shadow-lg ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <button
              type="button"
              disabled={busy}
              onClick={toggleBlock}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition"
            >
              <Ban size={15} /> {blocked ? "Unblock user" : "Block user"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReporting(true);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition"
            >
              <Flag size={15} /> Report {postId ? "post" : "user"}
            </button>
          </div>
        </>
      )}

      {reporting && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xl">
            <h2 className="text-base font-semibold">Report {postId ? "post" : "user"}</h2>
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
                onClick={() => setReporting(false)}
                className="flex-1 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={submitReport}
                className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                style={{ background: "var(--gradient-glow)" }}
              >
                Send report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}