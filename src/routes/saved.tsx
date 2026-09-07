import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls, isVideoPath } from "@/lib/storage";
import { LumenAvatar } from "@/components/LumenAvatar";
import { Bookmark, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved Posts · Lumen" },
      { name: "description", content: "Your private collection of saved Lumen posts, only visible to you." },
      { property: "og:title", content: "Saved Posts · Lumen" },
      { property: "og:description", content: "Your private collection of saved Lumen posts, only visible to you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavedPage,
});

type SavedPost = {
  id: string;
  user_id: string;
  caption: string | null;
  image_url: string | null;
  created_at: string;
  author?: { name: string | null; avatar_url: string | null } | null;
};

function SavedPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        navigate({ to: "/login" });
        return;
      }
      const { data: savedRows } = await (supabase as any)
        .from("saved_posts")
        .select("post_id,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      const ids = (savedRows ?? []).map((r: any) => r.post_id);
      if (!ids.length) {
        setPosts([]);
        setLoading(false);
        return;
      }
      const { data: postRows } = await supabase
        .from("posts")
        .select("id,user_id,caption,image_url,created_at")
        .in("id", ids);
      const list = (postRows ?? []) as SavedPost[];
      list.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

      const authorIds = Array.from(new Set(list.map((p) => p.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,avatar_url")
        .in("id", authorIds);
      const pmap: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => (pmap[p.id] = p));
      list.forEach((p) => (p.author = pmap[p.user_id] ?? null));

      const paths = [
        ...(list.map((p) => p.image_url).filter(Boolean) as string[]),
        ...((profs ?? []).map((p: any) => p.avatar_url).filter(Boolean) as string[]),
      ];
      setUrls(await getSignedUrls(paths));
      setPosts(list);
      setLoading(false);
    })();
  }, [navigate]);

  async function unsave(postId: string) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await (supabase as any).from("saved_posts").delete().eq("user_id", uid).eq("post_id", postId);
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/home" className="rounded-full p-2 hover:bg-muted" aria-label="Back to feed">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold">Saved Posts</h1>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          <Bookmark className="mx-auto mb-2 opacity-60" size={22} />
          Nothing saved yet. Tap the bookmark on any post to keep it here — only you can see this list.
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const media = p.image_url ? urls[p.image_url] : null;
            return (
              <li key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 p-3">
                  <Link to="/u/$id" params={{ id: p.user_id }}>
                    <LumenAvatar
                      name={p.author?.name}
                      url={p.author?.avatar_url ? urls[p.author.avatar_url] : null}
                      size={36}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.author?.name ?? "Lumen user"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => unsave(p.id)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-[#00BFFF] hover:bg-muted"
                  >
                    Unsave
                  </button>
                </div>
                {media &&
                  (isVideoPath(p.image_url) ? (
                    <video src={media} controls preload="metadata" className="max-h-96 w-full bg-black object-contain" />
                  ) : (
                    <img src={media} alt={p.caption ?? "Saved post"} loading="lazy" className="max-h-96 w-full object-cover" />
                  ))}
                {p.caption && <p className="whitespace-pre-wrap p-3 text-sm">{p.caption}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
