import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, MessageCircle, Sparkles, User as UserIcon, Image as ImageIcon, LogOut, Send } from "lucide-react";
import { getSignedUrls, uploadUserFile } from "@/lib/storage";

export const Route = createFileRoute("/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Home — Lumen" },
      { name: "description", content: "Your Lumen feed of glow moments." },
      { property: "og:title", content: "Home — Lumen" },
      { property: "og:description", content: "Your Lumen feed of glow moments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

type Profile = { id: string; name: string | null; avatar_url: string | null };
type PostRow = {
  id: string;
  user_id: string;
  caption: string | null;
  image_url: string | null;
  created_at: string;
};
type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

function HomePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, { count: number; likedByMe: boolean }>>({});
  const [comments, setComments] = useState<Record<string, CommentRow[]>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setUserId(data.user.id);
      await refresh(data.user.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(uid: string) {
    const { data: postRows } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (postRows ?? []) as PostRow[];
    setPosts(list);

    const userIds = Array.from(new Set(list.map((p) => p.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,avatar_url")
        .in("id", userIds);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as Profile));
      setProfiles(map);

      const paths = [
        ...list.map((p) => p.image_url).filter(Boolean) as string[],
        ...(profs ?? []).map((p) => p.avatar_url).filter(Boolean) as string[],
      ];
      setSignedUrls(await getSignedUrls(paths));
    }

    const postIds = list.map((p) => p.id);
    if (postIds.length) {
      const { data: likeRows } = await supabase
        .from("likes")
        .select("post_id,user_id")
        .in("post_id", postIds);
      const l: Record<string, { count: number; likedByMe: boolean }> = {};
      postIds.forEach((id) => (l[id] = { count: 0, likedByMe: false }));
      (likeRows ?? []).forEach((r) => {
        l[r.post_id].count += 1;
        if (r.user_id === uid) l[r.post_id].likedByMe = true;
      });
      setLikes(l);

      const { data: commentRows } = await supabase
        .from("comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
      const c: Record<string, CommentRow[]> = {};
      (commentRows ?? []).forEach((row) => {
        (c[row.post_id] ||= []).push(row as CommentRow);
      });
      setComments(c);

      // fetch profiles for commenters not already in map
      const commenterIds = Array.from(new Set((commentRows ?? []).map((r) => r.user_id)));
      const missing = commenterIds.filter((id) => !userIds.includes(id));
      if (missing.length) {
        const { data: extra } = await supabase
          .from("profiles")
          .select("id,name,avatar_url")
          .in("id", missing);
        setProfiles((prev) => {
          const next = { ...prev };
          (extra ?? []).forEach((p) => (next[p.id] = p as Profile));
          return next;
        });
      }
    }
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!caption.trim() && !file) {
      toast.error("Add a photo or a thought");
      return;
    }
    setPosting(true);
    try {
      let imagePath: string | null = null;
      if (file) imagePath = await uploadUserFile(userId, file, "posts");
      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        caption: caption.trim() || null,
        image_url: imagePath,
      });
      if (error) throw error;
      setCaption("");
      setFile(null);
      await refresh(userId);
      toast.success("Shared ✨");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(postId: string) {
    if (!userId) return;
    const cur = likes[postId] ?? { count: 0, likedByMe: false };
    setLikes({
      ...likes,
      [postId]: {
        count: cur.likedByMe ? cur.count - 1 : cur.count + 1,
        likedByMe: !cur.likedByMe,
      },
    });
    if (cur.likedByMe) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabase.from("likes").insert({ post_id: postId, user_id: userId });
    }
  }

  async function addComment(postId: string, content: string) {
    if (!userId || !content.trim()) return;
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: userId, content: content.trim() })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] ?? []), data as CommentRow],
    }));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center" style={{ background: "var(--gradient-bg)" }}>
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur bg-background/60 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-full grid place-items-center text-primary-foreground"
              style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
            >
              <Sparkles size={16} />
            </div>
            <span className="text-base font-semibold tracking-tight">Lumen</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm hover:bg-accent transition"
            >
              <UserIcon size={14} /> Profile
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm hover:bg-accent transition"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        <form
          onSubmit={handleCreatePost}
          className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4 space-y-3"
        >
          <textarea
            placeholder="What's on your mind?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full resize-none bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          {file && (
            <p className="text-xs text-muted-foreground truncate">📎 {file.name}</p>
          )}
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
              <ImageIcon size={16} />
              Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="submit"
              disabled={posting}
              className="rounded-full px-4 py-1.5 text-sm text-primary-foreground font-medium disabled:opacity-60"
              style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
            >
              {posting ? "Sharing…" : "Share"}
            </button>
          </div>
        </form>

        {posts.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            No posts yet. Be the first to glow.
          </div>
        )}

        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            author={profiles[post.user_id]}
            imageUrl={post.image_url ? signedUrls[post.image_url] : undefined}
            avatarUrl={
              profiles[post.user_id]?.avatar_url
                ? signedUrls[profiles[post.user_id]!.avatar_url as string]
                : undefined
            }
            likeState={likes[post.id] ?? { count: 0, likedByMe: false }}
            comments={comments[post.id] ?? []}
            profiles={profiles}
            avatarLookup={signedUrls}
            open={!!openComments[post.id]}
            onToggleOpen={() =>
              setOpenComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
            }
            onLike={() => toggleLike(post.id)}
            onComment={(text) => addComment(post.id, text)}
          />
        ))}
      </div>
    </main>
  );
}

function PostCard({
  post,
  author,
  imageUrl,
  avatarUrl,
  likeState,
  comments,
  profiles,
  avatarLookup,
  open,
  onToggleOpen,
  onLike,
  onComment,
}: {
  post: PostRow;
  author?: Profile;
  imageUrl?: string;
  avatarUrl?: string;
  likeState: { count: number; likedByMe: boolean };
  comments: CommentRow[];
  profiles: Record<string, Profile>;
  avatarLookup: Record<string, string>;
  open: boolean;
  onToggleOpen: () => void;
  onLike: () => void;
  onComment: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const when = useMemo(
    () => new Date(post.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    [post.created_at]
  );

  return (
    <article className="rounded-2xl border border-border bg-card/70 backdrop-blur overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar name={author?.name} url={avatarUrl} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{author?.name || "Lumen friend"}</p>
          <p className="text-xs text-muted-foreground">{when}</p>
        </div>
      </header>
      {imageUrl && (
        <img src={imageUrl} alt="" className="w-full max-h-[520px] object-cover" />
      )}
      {post.caption && (
        <p className="px-4 pt-3 text-sm text-foreground whitespace-pre-wrap">{post.caption}</p>
      )}
      <div className="px-4 py-3 flex items-center gap-4 text-sm">
        <button
          onClick={onLike}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition"
        >
          <Heart
            size={18}
            className={likeState.likedByMe ? "fill-primary text-primary" : ""}
          />
          <span>{likeState.count}</span>
        </button>
        <button
          onClick={onToggleOpen}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition"
        >
          <MessageCircle size={18} />
          <span>{comments.length}</span>
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          )}
          {comments.map((c) => {
            const p = profiles[c.user_id];
            const av = p?.avatar_url ? avatarLookup[p.avatar_url] : undefined;
            return (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar name={p?.name} url={av} size={28} />
                <div className="flex-1 rounded-2xl bg-background/60 px-3 py-2">
                  <p className="text-xs font-medium">{p?.name || "Lumen friend"}</p>
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            );
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onComment(text);
              setText("");
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              maxLength={500}
              className="flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="h-9 w-9 grid place-items-center rounded-full text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--gradient-glow)" }}
              aria-label="Send comment"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function Avatar({ name, url, size = 36 }: { name?: string | null; url?: string; size?: number }) {
  const initials = (name || "L").trim().charAt(0).toUpperCase();
  return url ? (
    <img
      src={url}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full grid place-items-center text-primary-foreground font-medium"
      style={{
        width: size,
        height: size,
        background: "var(--gradient-glow)",
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}