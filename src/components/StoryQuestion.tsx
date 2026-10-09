import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendQuickReply } from "@/lib/quickReply";
import type { StoryRow } from "@/lib/stories";

/** Interactive "Ask me anything" card; answers go to the author as a story-quoted DM. */
export function StoryQuestion({ story, prompt, meId }: { story: StoryRow; prompt: string; meId: string | null }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const owner = meId === story.user_id;
  const title = prompt?.trim() || "Ask me anything";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!meId || busy || !answer.trim()) return;
    setBusy(true);
    try {
      await sendQuickReply({ from: meId, to: story.user_id, kind: "story", quote: `Question: ${title}`, content: answer });
      setAnswer(""); setSent(true); toast.success("Answer sent");
    } catch (err: any) { toast.error(err?.message ?? "Couldn't send answer"); }
    finally { setBusy(false); }
  }

  return (
    <div className="pointer-events-auto w-full max-w-xs rounded-2xl border border-primary/40 bg-card/95 p-3 text-card-foreground" style={{ boxShadow: "var(--shadow-glow)" }}>
      <p className="mb-2 text-center text-sm font-semibold">{title}</p>
      {owner || !meId ? (
        <p className="text-center text-xs text-muted-foreground">{owner ? "Answers arrive in your Messages." : "Sign in to answer."}</p>
      ) : sent ? (
        <p className="text-center text-xs text-primary">Sent! ✨ <button className="underline" onClick={() => setSent(false)}>Answer again</button></p>
      ) : (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={300} placeholder="Type your answer…" aria-label="Your answer" className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" disabled={busy || !answer.trim()} aria-label="Send answer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-glow)" }}><Send size={15} /></button>
        </form>
      )}
    </div>
  );
}
