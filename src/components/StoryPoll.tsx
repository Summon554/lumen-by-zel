import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { StoryRow, Sticker } from "@/lib/stories";

export function StoryPoll({ story, poll, meId }: { story: StoryRow; poll: Extract<Sticker, { kind: "poll" }>; meId: string | null }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [counts, setCounts] = useState([0, 0]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const owner = story.user_id === meId;
  const expired = new Date(story.expires_at).getTime() <= Date.now();
  async function load() {
    const [results, own] = await Promise.all([
      supabase.rpc("story_poll_results", { p_story_id: story.id }),
      meId ? supabase.from("story_poll_votes").select("option_index").eq("story_id", story.id).eq("user_id", meId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (results.error || own.error) throw results.error || own.error;
    setCounts([0, 1].map(i => Number(results.data?.find(r => r.option_index === i)?.votes ?? 0)));
    setChoice(own.data?.option_index ?? null);
  }
  useEffect(() => {
    void load().catch(() => toast.error("Couldn't load poll results")).finally(() => setLoading(false));
    const timer = setInterval(() => void load().catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [story.id, meId]);
  async function vote(index: number) {
    if (!meId || owner || expired || choice !== null || busy || loading) return;
    setBusy(true);
    const { error } = await supabase.from("story_poll_votes").insert({ story_id: story.id, user_id: meId, option_index: index });
    if (error) {
      if (error.code !== "23505") toast.error("Couldn't save your vote. Try again.");
      else toast.info("You've already voted on this story.");
    } else { setChoice(index); setCounts(prev => prev.map((n, i) => n + (i === index ? 1 : 0))); }
    await load().catch(() => {}); setBusy(false);
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const show = choice !== null || owner || expired;
  return <div className="pointer-events-auto w-full max-w-xs rounded-lg border border-primary/40 bg-card p-3 text-card-foreground shadow-lg">
    <p className="mb-3 break-words text-center text-sm font-semibold">{poll.question}</p>
    <div className="space-y-2">{poll.options.map((option, i) => {
      const percentage = total ? Math.round((counts[i] ?? 0) / total * 100) : 0;
      return <Button key={i} variant="outline" onClick={() => void vote(i)} disabled={busy || loading || show || !meId} className="relative h-auto min-h-10 w-full overflow-hidden whitespace-normal px-3 py-2">
        {show && <span aria-hidden className="poll-fill absolute inset-y-0 left-0 bg-primary/25" style={{ width: `${percentage}%` }}/>}<span className="relative flex w-full items-center justify-between gap-2"><span className="break-words text-left">{option}</span>{show && <span className="flex shrink-0 items-center gap-1 text-primary">{choice === i && <Check size={12}/>} {percentage}%</span>}</span>
      </Button>;
    })}</div>
    <p className="mt-2 text-center text-[11px] text-muted-foreground">{loading ? "Loading…" : `${total} vote${total === 1 ? "" : "s"}${expired ? " · Poll closed" : choice !== null ? " · You voted" : owner ? " · Your poll" : ""}`}</p>
  </div>;
}
