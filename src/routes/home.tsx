import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Heart,
  MessageCircle,
  Sparkles,
  User as UserIcon,
  Image as ImageIcon,
  LogOut,
  Bell,
  Search as SearchIcon,
} from "lucide-react";
import { getSignedUrls, uploadUserFile } from "@/lib/storage";
import { isFounder } from "@/lib/founder";
import { FounderBadge } from "@/components/FounderBadge";
import { CommentThread, type ThreadComment, type CommentLikeState } from "@/components/CommentThread";

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

type Profile = { id: string; name: string | null; email: string | null; avatar_url: string | null };
type PostRow = {
  id: string;
  user_id: string;
  caption: string | null;
  image_url: string | null;
  created_at: string;
};
type CommentRow = ThreadComment;

function HomePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, { count: number; likedByMe: boolean }>>({});
  const [comments, setComments] = useState<Record<string, CommentRow[]>>({});
  const [commentLikes, setCommentLikes] = useState<Record<string, CommentLikeState>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [tab, setTab] = useState<"forYou" | "following">("forYou");
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setUserId(data.user.id);
      await Promise.all([refresh(data.user.id), loadFollowing(data.user.id), loadUnread(data.user.id)]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFollowing(uid: string) {
    const { data } = await (supabase as any)
      .from("follows")
      .select("following_id")
      .eq("follower_id", uid);
    setFollowingIds(new Set((data ?? []).map((r: any) => r.following_id)));
  }

  async function loadUnread(uid: string) {
    const { count } = await (supabase as any)
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("read", false);
    setUnread(count ?? 0);
  }

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
        .select("id,name,email,avatar_url")
        .in("id", userIds);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as Profile));
      setProfiles(map);

      const paths = [
        ...(list.map((p) => p.image_url).filter(Boolean) as string[]),
        ...((profs ?? []).map((p) => p.avatar_url).filter(Boolean) as string[]),
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

      const commentIds = (commentRows ?? []).map((r) => r.id);
      if (commentIds.length) {
        const { data: cl } = await (supabase as any)
          .from("comment_likes")
          .select("comment_id,user_id")
          .in("comment_id", commentIds);
        const map: Record<string, CommentLikeState> = {};
        commentIds.forEach((id) => (map[id] = { count: 0, likedByMe: false }));
        (cl ?? []).forEach((r: any) => {
          map[r.comment_id].count += 1;
          if (r.user_id === uid) map[r.comment_id].likedByMe = true;
        });
        setCommentLikes(map);
      } else {
        setCommentLikes({});
      }

      const commenterIds = Array.from(new Set((commentRows ?? []).map((r) => r.user_id)));
      const missing = commenterIds.filter((id) => !userIds.includes(id));
      if (missing.length) {
        const { data: extra } = await supabase
          .from("profiles")
          .select("id,name,email,avatar_url")
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

  async function toggleLike(post: PostRow) {
    if (!userId) return;
    const cur = likes[post.id] ?? { count: 0, likedByMe: false };
    const willLike = !cur.likedByMe;
    setLikes({
      ...likes,
      [post.id]: {
        count: willLike ? cur.count + 1 : cur.count - 1,
        likedByMe: willLike,
      },
    });
    if (willLike) {
      await supabase.from("likes").insert({ post_id: post.id, user_id: userId });
      if (post.user_id !== userId) {
        await (supabase as any).from("notifications").insert({
          user_id: post.user_id,
          actor_id: userId,
          type: "like",
          post_id: post.id,
        });
      }
    } else {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", userId);
    }
  }

  async function toggleFollow(targetId: string) {
    if (!userId || targetId === userId) return;
    const next = new Set(followingIds);
    if (next.has(targetId)) {
      next.delete(targetId);
      setFollowingIds(next);
      await (supabase as any)
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", targetId);
    } else {
      next.add(targetId);
      setFollowingIds(next);
      const { error } = await (supabase as any)
        .from("follows")
        .insert({ follower_id: userId, following_id: targetId });
      if (error) {
        next.delete(targetId);
        setFollowingIds(new Set(next));
        toast.error(error.message);
      } else {
        await (supabase as any).from("notifications").insert({
          user_id: targetId,
          actor_id: userId,
          type: "follow",
          post_id: null,
        });
      }
    }
  }

  function localAddComment(postId: string, c: CommentRow) {
    setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), c] }));
    setCommentLikes((prev) => ({ ...prev, [c.id]: { count: 0, likedByMe: false } }));
  }
  function localChangeCommentLike(commentId: string, next: CommentLikeState) {
    setCommentLikes((prev) => ({ ...prev, [commentId]: next }));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const visiblePosts = useMemo(() => {
    if (tab === "following") {
      return posts.filter((p) => followingIds.has(p.user_id) || p.user_id === userId);
    }
    return posts;
  }, [tab, posts, followingIds, userId]);

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
          <div className="flex items-center gap-1">
            <Link
              to="/search"
              className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent transition"
              aria-label="Search"
            >
              <SearchIcon size={18} />
            </Link>
            <Link
              to="/notifications"
              className="relative h-9 w-9 grid place-items-center rounded-full hover:bg-accent transition"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold grid place-items-center text-primary-foreground"
                  style={{ background: "var(--gradient-glow)" }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link
              to="/profile"
              className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent transition"
              aria-label="Profile"
            >
              <UserIcon size={18} />
            </Link>
            <button
              onClick={handleLogout}
              className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent transition"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 pb-2 flex items-center gap-1">
          <TabButton active={tab === "forYou"} onClick={() => setTab("forYou")}>For You</TabButton>
          <TabButton active={tab === "following"} onClick={() => setTab("following")}>Following</TabButton>
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
          {file && <p className="text-xs text-muted-foreground truncate">📎 {file.name}</p>}
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

        {visiblePosts.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            {tab === "following"
              ? "Follow people to see their posts here."
              : "No posts yet. Be the first to glow."}
          </div>
        )}

        {visiblePosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            me={userId}
            author={profiles[post.user_id]}
            imageUrl={post.image_url ? signedUrls[post.image_url] : undefined}
            avatarUrl={
              profiles[post.user_id]?.avatar_url
                ? signedUrls[profiles[post.user_id]!.avatar_url as string]
                : undefined
            }
            likeState={likes[post.id] ?? { count: 0, likedByMe: false }}
            comments={comments[post.id] ?? []}
            commentLikes={commentLikes}
            profiles={profiles}
            avatarLookup={signedUrls}
            open={!!openComments[post.id]}
            isFollowingAuthor={followingIds.has(post.user_id)}
            onToggleOpen={() =>
              setOpenComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
            }
            onLike={() => toggleLike(post)}
            onLocalAddComment={(c) => localAddComment(post.id, c)}
            onLocalCommentLikeChange={localChangeCommentLike}
            onToggleFollow={() => toggleFollow(post.user_id)}
          />
        ))}
      </div>
    </main>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="relative px-4 py-1.5 text-sm font-medium transition"
      style={{ color: active ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}
    >
      {children}
      {active && (
        <span
          className="absolute left-2 right-2 -bottom-0.5 h-0.5 rounded-full"
          style={{ background: "var(--gradient-glow)" }}
        />
      )}
    </button>
  );
}

function PostCard({
  post,
  me,
  author,
  imageUrl,
  avatarUrl,
  likeState,
  comments,
  commentLikes,
  profiles,
  avatarLookup,
  open,
  isFollowingAuthor,
  onToggleOpen,
  onLike,
  onLocalAddComment,
  onLocalCommentLikeChange,
  onToggleFollow,
}: {
  post: PostRow;
  me: string | null;
  author?: Profile;
  imageUrl?: string;
  avatarUrl?: string;
  likeState: { count: number; likedByMe: boolean };
  comments: CommentRow[];
  commentLikes: Record<string, CommentLikeState>;
  profiles: Record<string, Profile>;
  avatarLookup: Record<string, string>;
  open: boolean;
  isFollowingAuthor: boolean;
  onToggleOpen: () => void;
  onLike: () => void;
  onLocalAddComment: (c: CommentRow) => void;
  onLocalCommentLikeChange: (commentId: string, next: CommentLikeState) => void;
  onToggleFollow: () => void;
}) {
  const when = useMemo(
    () => new Date(post.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    [post.created_at]
  );
  const isMine = me === post.user_id;
  const founder = isFounder(author?.email);

  return (
    <article className="rounded-2xl border border-border bg-card/70 backdrop-blur overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link to="/u/$id" params={{ id: post.user_id }}>
          <Avatar name={author?.name} url={avatarUrl} size={36} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate flex items-center gap-1.5">
            <Link to="/u/$id" params={{ id: post.user_id }} className="hover:underline">
              {author?.name || "Lumen friend"}
            </Link>
            {founder && <FounderBadge size={12} showLabel={false} />}
          </p>
          <p className="text-xs text-muted-foreground">{when}</p>
        </div>
        {!isMine && (
          <button
            onClick={onToggleFollow}
            className="text-xs font-medium rounded-full px-3 py-1 transition"
            style={
              isFollowingAuthor
                ? { border: "1px solid var(--color-border)", background: "hsl(0 0% 100% / 0.6)", color: "var(--color-foreground)" }
                : { background: "var(--gradient-glow)", color: "var(--color-primary-foreground)" }
            }
          >
            {isFollowingAuthor ? "Following" : "Follow"}
          </button>
        )}
      </header>
      {imageUrl && <img src={imageUrl} alt="" className="w-full max-h-[520px] object-cover" />}
      {post.caption && (
        <p className="px-4 pt-3 text-sm text-foreground whitespace-pre-wrap">{post.caption}</p>
      )}
      <div className="px-4 py-3 flex items-center gap-4 text-sm">
        <button onClick={onLike} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition">
          <Heart size={18} className={likeState.likedByMe ? "fill-primary text-primary" : ""} />
          <span>{likeState.count}</span>
        </button>
        <button onClick={onToggleOpen} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition">
          <MessageCircle size={18} />
          <span>{comments.length}</span>
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <CommentThread
            postId={post.id}
            postAuthorId={post.user_id}
            meId={me}
            comments={comments}
            likes={commentLikes}
            profiles={profiles}
            avatarLookup={avatarLookup}
            onLocalAdd={onLocalAddComment}
            onLocalLikeChange={onLocalCommentLikeChange}
          />
        </div>
      )}
    </article>
  );
}

function Avatar({ name, url, size = 36 }: { name?: string | null; url?: string; size?: number }) {
  const initials = (name || "L").trim().charAt(0).toUpperCase();
  return url ? (
    <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
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