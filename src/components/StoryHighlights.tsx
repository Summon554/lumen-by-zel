import { useCallback, useEffect, useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import type { StoryRow } from "@/lib/stories";
import { StoryViewer } from "@/components/StoryViewer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Highlight = { id: string; title: string; cover_story_id: string | null; created_at: string };
type Item = { highlight_id: string; story_id: string; position: number };

export function StoryHighlights({ userId, meId, name, avatar }: { userId: string; meId: string | null; name: string | null; avatar: string | null }) {
  const owner = userId === meId;
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cover, setCover] = useState("");
  const [active, setActive] = useState<StoryRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [archive, setArchive] = useState<StoryRow[]>([]);

  const load = useCallback(async () => {
    const sb = supabase as any;
    const { data: hs, error } = await sb.from("story_highlights").select("id,title,cover_story_id,created_at").eq("user_id", userId).order("created_at");
    if (error) return;
    const list = (hs ?? []) as Highlight[];
    setHighlights(list);
    const ids = list.map((h) => h.id);
    if (!ids.length) { setItems([]); setStories([]); return; }
    const { data: links } = await sb.from("story_highlight_items").select("highlight_id,story_id,position").in("highlight_id", ids).order("position");
    const entries = (links ?? []) as Item[];
    setItems(entries);
    const storyIds = [...new Set(entries.map((i) => i.story_id))];
    if (!storyIds.length) { setStories([]); return; }
    const { data: rows } = await sb.from("stories").select("*").in("id", storyIds);
    const visible = (rows ?? []) as StoryRow[];
    setStories(visible);
    setUrls(await getSignedUrls(visible.map((s) => s.media_url).filter(Boolean) as string[]));
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function openCreator() {
    setCreating(true);
    const { data } = await (supabase as any).from("stories").select("*").eq("user_id", userId).lte("expires_at", new Date().toISOString()).eq("held_for_moderation", false).order("created_at", { ascending: false }).limit(100);
    const rows = (data ?? []) as StoryRow[];
    setArchive(rows);
    setUrls((prev) => ({ ...prev }));
    const signed = await getSignedUrls(rows.map((s) => s.media_url).filter(Boolean) as string[]);
    setUrls((prev) => ({ ...prev, ...signed }));
  }

  async function create() {
    if (!meId || !title.trim() || !selected.length || busy) return;
    setBusy(true);
    const sb = supabase as any;
    const { data: h, error } = await sb.from("story_highlights").insert({ user_id: meId, title: title.trim(), cover_story_id: cover || selected[0] }).select("id").single();
    if (error || !h) { toast.error(error?.message ?? "Could not create highlight"); setBusy(false); return; }
    const { error: itemError } = await sb.from("story_highlight_items").insert(selected.map((story_id, position) => ({ highlight_id: h.id, story_id, position })));
    if (itemError) { await sb.from("story_highlights").delete().eq("id", h.id); toast.error(itemError.message); }
    else { toast.success("Highlight added"); setCreating(false); setTitle(""); setSelected([]); setCover(""); await load(); }
    setBusy(false);
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("story_highlights").delete().eq("id", id);
    if (error) toast.error(error.message); else void load();
  }

  if (!owner && !highlights.some((h) => items.some((i) => i.highlight_id === h.id && stories.some((s) => s.id === i.story_id)))) return null;
  return <section className="mx-auto mt-7 max-w-lg px-4" aria-label="Story Highlights">
    <h2 className="mb-3 text-sm font-semibold text-foreground">Story Highlights</h2>
    <div className="flex gap-4 overflow-x-auto pb-2">
      {owner && <Button variant="ghost" className="h-auto w-16 shrink-0 flex-col gap-1 p-0" onClick={openCreator} aria-label="New highlight"><span className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-primary text-primary"><Plus size={24}/></span><span className="text-xs">New</span></Button>}
      {highlights.map((h) => {
        const list = items.filter((i) => i.highlight_id === h.id).map((i) => stories.find((s) => s.id === i.story_id)).filter((s): s is StoryRow => !!s);
        if (!list.length) return null;
        const first = list.find((s) => s.id === h.cover_story_id) ?? list[0];
        return <div key={h.id} className="relative w-16 shrink-0 text-center">
          <Button variant="ghost" className="h-auto w-16 flex-col gap-1 p-0" onClick={() => setActive(list)} aria-label={`Play ${h.title}`}>
            <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-primary bg-accent text-xl text-primary" style={!first.media_url ? { background: first.background ?? "var(--gradient-glow)" } : undefined}>
              {first.media_url && urls[first.media_url] ? first.kind === "video" ? <video src={urls[first.media_url]} muted playsInline className="h-full w-full object-cover"/> : <img src={urls[first.media_url]} alt="" className="h-full w-full object-cover"/> : "✦"}
            </span><span className="max-w-16 truncate text-xs">{h.title}</span>
          </Button>
          {owner && <Button size="icon" variant="secondary" className="absolute -right-2 -top-1 h-6 w-6 rounded-full" aria-label={`Delete ${h.title}`} onClick={() => remove(h.id)}><Trash2 size={12}/></Button>}
        </div>;
      })}
    </div>
    {active && <StoryViewer stories={active} authorName={name} authorAvatar={avatar} meId={meId} isHighlight onClose={() => setActive(null)} />}
    {creating && <div className="fixed inset-0 z-[75] flex items-end justify-center bg-foreground/60" role="dialog" aria-modal="true" aria-label="New highlight"><div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-background p-4 text-foreground">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">New highlight</h3><Button size="icon" variant="ghost" onClick={() => setCreating(false)} aria-label="Close"><X size={18}/></Button></div>
      <input aria-label="Highlight title" maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mb-4 w-full rounded-md border border-border bg-card p-3 outline-none focus:ring-2 focus:ring-ring" />
      <p className="mb-2 text-sm text-muted-foreground">Select archived moments · {selected.length} selected</p>
      {!archive.length && <p className="py-8 text-center text-sm text-muted-foreground">No archived moments yet.</p>}
      <div className="grid grid-cols-3 gap-2">{archive.map((s) => <Button key={s.id} variant="ghost" className={`relative aspect-[9/16] h-auto overflow-hidden rounded-md border p-0 ${selected.includes(s.id) ? "border-primary ring-2 ring-primary" : "border-border"}`} onClick={() => { setSelected((old) => old.includes(s.id) ? old.filter((id) => id !== s.id) : [...old, s.id]); if (!cover) setCover(s.id); }} aria-label={`Select moment from ${new Date(s.created_at).toLocaleDateString()}`}>
        {s.media_url && urls[s.media_url] ? s.kind === "video" ? <video src={urls[s.media_url]} muted className="h-full w-full object-cover"/> : <img src={urls[s.media_url]} alt="" className="h-full w-full object-cover"/> : <span className="whitespace-normal p-2 text-xs">{s.text_content || "Moment"}</span>}
        {selected.includes(s.id) && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground text-xs">✓</span>}
      </Button>)}</div>
      {!!selected.length && <label className="mt-4 block text-sm">Cover<select value={selected.includes(cover) ? cover : selected[0]} onChange={(e) => setCover(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-card p-2">{selected.map((id, i) => <option key={id} value={id}>Moment {i + 1}</option>)}</select></label>}
      <Button className="mt-4 w-full" disabled={!title.trim() || !selected.length || busy} onClick={create}>{busy ? "Saving…" : "Create highlight"}</Button>
    </div></div>}
  </section>;
}
