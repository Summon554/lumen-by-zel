import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowUpRight, Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls, isVideoPath } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LumenAvatar } from "@/components/LumenAvatar";

export type Spark = { spark_day: string; question: string };
type Response = { id: string; user_id: string; caption: string | null; image_url: string | null; media_paths: string[] };
type Author = { name: string | null; avatar_url: string | null };
export function DailySpark({ onRespond }: { onRespond: (spark: Spark) => void }) {
  const [spark, setSpark] = useState<Spark | null>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Response[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc("current_daily_spark");
      if (error) { setFailed(true); return; }
      setSpark(data?.[0] ?? null);
    }
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => clearInterval(timer);
  }, []);
  async function browse(reset = true) {
    if (!spark || busy) return;
    setOpen(true); setBusy(true);
    try {
      const start = reset ? 0 : rows.length;
      const { data, error } = await supabase.from("posts").select("id,user_id,caption,image_url,media_paths")
        .eq("spark_day", spark.spark_day).order("created_at", { ascending: false }).order("id").range(start, start + 19);
      if (error) throw error;
      const list = data ?? [];
      const ids = [...new Set(list.map(p => p.user_id))];
      const { data: profiles, error: profileError } = ids.length ? await supabase.from("profiles").select("id,name,avatar_url").in("id", ids) : { data: [], error: null };
      if (profileError) throw profileError;
      const paths = [...list.flatMap(p => p.media_paths?.length ? p.media_paths : p.image_url ? [p.image_url] : []), ...(profiles ?? []).flatMap(p => p.avatar_url ? [p.avatar_url] : [])];
      const signed = await getSignedUrls(paths);
      setAuthors(prev => ({ ...prev, ...Object.fromEntries((profiles ?? []).map(p => [p.id, p])) }));
      setUrls(prev => ({ ...prev, ...signed }));
      setRows(prev => reset ? list : [...prev, ...list]); setMore(list.length === 20);
    } catch { toast.error("Couldn't load community responses. Try again."); }
    finally { setBusy(false); }
  }
  if (!spark) return failed ? <p className="text-xs text-muted-foreground">Daily Spark is unavailable right now.</p> : null;
  return <section className="border-y border-primary/30 py-4">
    <div className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 font-semibold text-primary"><Flame size={16}/> DAILY SPARK</span><span className="text-muted-foreground">{spark.spark_day} · Manila</span></div>
    <Button variant="ghost" onClick={() => void browse()} className="mt-2 h-auto w-full justify-between whitespace-normal px-0 text-left text-lg font-semibold hover:bg-transparent"><span>{spark.question}</span><ArrowUpRight className="shrink-0"/></Button>
    <Button className="mt-3" size="sm" onClick={() => onRespond(spark)}><Sparkles/> Glow Back</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg">
      <DialogTitle>Community Spark</DialogTitle><DialogDescription>{spark.question}</DialogDescription>
      {busy && !rows.length && <p className="text-sm text-muted-foreground">Loading responses…</p>}
      {!busy && !rows.length && <div className="py-8 text-center"><Sparkles className="mx-auto mb-3 text-primary"/><p>No responses yet.</p><Button className="mt-4" onClick={() => { setOpen(false); onRespond(spark); }}>Glow Back</Button></div>}
      {rows.map(row => <article key={row.id} className="border-b border-border pb-4">
        <Link to="/u/$id" params={{ id: row.user_id }} className="mb-3 flex items-center gap-2"><LumenAvatar size={30} name={authors[row.user_id]?.name} url={urls[authors[row.user_id]?.avatar_url ?? ""]}/><span className="text-sm font-medium">{authors[row.user_id]?.name || "Lumen friend"}</span></Link>
        <div className="flex snap-x snap-mandatory overflow-x-auto">{(row.media_paths?.length ? row.media_paths : row.image_url ? [row.image_url] : []).map(path => <div key={path} className="w-full shrink-0 snap-center">{urls[path] && (isVideoPath(path) ? <video src={urls[path]} controls playsInline className="max-h-80 w-full object-contain"/> : <img src={urls[path]} alt="Spark response" loading="lazy" className="max-h-80 w-full object-contain"/>)}</div>)}</div>
        {row.caption && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{row.caption}</p>}
      </article>)}
      {more && <Button variant="outline" disabled={busy} onClick={() => void browse(false)}>{busy ? "Loading…" : "Load more"}</Button>}
    </DialogContent></Dialog>
  </section>;
}
