import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { toast } from "sonner";
import type { StoryRow } from "@/lib/stories";

export const Route = createFileRoute("/stories/archive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Archived Stories — Lumen" },
      { name: "description", content: "Your private archive of past Lumen Light Moments." },
      { property: "og:title", content: "Archived Stories — Lumen" },
      { property: "og:description", content: "Your private archive of past Lumen Light Moments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const [rows, setRows] = useState<StoryRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      const sb = supabase as any;
      await sb
        .from("stories")
        .update({ archived: true })
        .eq("user_id", auth.user.id)
        .eq("archived", false)
        .lte("expires_at", new Date().toISOString());
      const { data } = await sb
        .from("stories")
        .select("*")
        .eq("user_id", auth.user.id)
        .eq("archived", true)
        .order("created_at", { ascending: false });
      const list = (data ?? []) as StoryRow[];
      setRows(list);
      setUrls(await getSignedUrls(list.map((s) => s.media_url).filter(Boolean) as string[]));
      setLoading(false);
    })();
  }, []);

  async function remove(id: string) {
    const { error } = await (supabase as any).from("stories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((s) => s.id !== id));
    toast.success("Deleted permanently");
  }

  return (
    <main className="min-h-screen pb-16" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <Link to="/home" className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-base font-semibold">Archived Stories</h1>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 py-5">
        <p className="text-xs text-muted-foreground">
          Only you can see these. Nothing is lost after 24 hours unless you delete it yourself.
        </p>
        {loading && <p className="mt-6 text-center text-sm text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">No archived Light Moments yet.</p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {rows.map((s) => (
            <div key={s.id} className="relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-card">
              {s.media_url && urls[s.media_url] && s.kind === "photo" && (
                <img src={urls[s.media_url]} alt="Archived story" className="h-full w-full object-cover" />
              )}
              {s.media_url && urls[s.media_url] && s.kind === "video" && (
                <video src={urls[s.media_url]} className="h-full w-full object-cover" muted />
              )}
              {(s.kind === "text" || s.kind === "music") && (
                <div
                  className="grid h-full w-full place-items-center p-2 text-center text-[11px] text-white"
                  style={{ background: s.background ?? "linear-gradient(135deg,#00BFFF,#3AA8FF)" }}
                >
                  {s.text_content}
                </div>
              )}
              <button
                onClick={() => remove(s.id)}
                aria-label="Delete story"
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}