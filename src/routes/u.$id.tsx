import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getSignedUrl, getSignedUrls } from "@/lib/storage";
import { FounderBadge } from "@/components/FounderBadge";
import { UserActionMenu } from "@/components/UserActionMenu";
import { PresenceDot } from "@/components/PresenceDot";
import { isOnline, lastSeenLabel } from "@/lib/presence";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/u/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profile — Lumen" },
      { name: "description", content: "A Lumen profile." },
      { property: "og:title", content: "Profile — Lumen" },
      { property: "og:description", content: "A Lumen profile." },
    ],
  }),
  component: UserProfilePage,
});

type Post = { id: string; image_url: string | null; caption: string | null; created_at: string };
type Profile = {
  id: string;
  name: string | null;
  bio: string | null;
  is_founder: boolean | null;
  avatar_url: string | null;
  is_private?: boolean | null;
  last_seen_at?: string | null;
};

function UserProfilePage() {
  const { id } = useParams({ from: "/u/$id" });
  const navigate = useNavigate();
  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postUrls, setPostUrls] = useState<Record<string, string>>({});
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      if (auth.user.id === id) {
        navigate({ to: "/profile", replace: true });
        return;
      }
      setMeId(auth.user.id);
      const [{ data: prof }, { data: postRows }, followersRes, followingRes, meFollowsRes, meReqRes, blockRes] = await Promise.all([
        supabase.from("profiles").select("id,name,bio,is_founder,avatar_url,is_private,last_seen_at").eq("id", id).maybeSingle(),
        supabase.from("posts").select("id,image_url,caption,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(9),
        (supabase as any).from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
        (supabase as any).from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
        (supabase as any).from("follows").select("id").eq("follower_id", auth.user.id).eq("following_id", id).maybeSingle(),
        (supabase as any).from("follow_requests").select("id,status").eq("requester_id", auth.user.id).eq("target_id", id).maybeSingle(),
        (supabase as any).from("blocks").select("id").eq("blocker_id", auth.user.id).eq("blocked_id", id).maybeSingle(),
      ]);
      setBlocked(!!blockRes?.data);
      setProfile(prof as Profile | null);
      if (prof?.avatar_url) setAvatarUrl(await getSignedUrl(prof.avatar_url));
      const list = (postRows ?? []) as Post[];
      setPosts(list);
      setPostUrls(await getSignedUrls(list.map((p) => p.image_url).filter(Boolean) as string[]));
      setFollowers(followersRes.count ?? 0);
      setFollowing(followingRes.count ?? 0);
      setIsFollowing(!!meFollowsRes.data);
      setRequestPending(meReqRes?.data?.status === "pending");
      setLoading(false);
    })();
  }, [id, navigate]);

  async function toggleFollow() {
    if (!meId || !profile) return;
    setBusy(true);
    if (isFollowing) {
      await (supabase as any).from("follows").delete().eq("follower_id", meId).eq("following_id", profile.id);
      setIsFollowing(false);
      setFollowers((c) => Math.max(0, c - 1));
    } else if (profile.is_private && !isFollowing) {
      if (requestPending) {
        await (supabase as any)
          .from("follow_requests")
          .delete()
          .eq("requester_id", meId)
          .eq("target_id", profile.id);
        setRequestPending(false);
      } else {
        const { error } = await (supabase as any)
          .from("follow_requests")
          .insert({ requester_id: meId, target_id: profile.id, status: "pending" });
        if (error) {
          toast.error(error.message);
        } else {
          setRequestPending(true);
          await (supabase as any).from("notifications").insert({
            user_id: profile.id,
            actor_id: meId,
            type: "follow_request",
            post_id: null,
          });
          toast.success("Follow request sent");
        }
      }
    } else {
      const { error } = await (supabase as any).from("follows").insert({ follower_id: meId, following_id: profile.id });
      if (error) {
        toast.error(error.message);
      } else {
        setIsFollowing(true);
        setFollowers((c) => c + 1);
        await (supabase as any).from("notifications").insert({
          user_id: profile.id,
          actor_id: meId,
          type: "follow",
          post_id: null,
        });
      }
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center" style={{ background: "var(--gradient-bg)" }}>
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen grid place-items-center" style={{ background: "var(--gradient-bg)" }}>
        <p className="text-sm text-muted-foreground">Profile not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur bg-background/60 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Home
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <span className="text-base font-semibold tracking-tight">Profile</span>
          </div>
          <UserActionMenu meId={meId} targetUserId={id} blocked={blocked} onBlockedChange={setBlocked} />
        </div>
      </header>

      <section className="max-w-lg mx-auto px-4 pt-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative">
            <div
              className="h-28 w-28 rounded-full overflow-hidden grid place-items-center text-primary-foreground text-4xl font-medium"
              style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile.name || "L").trim().charAt(0).toUpperCase()
              )}
            </div>
            <PresenceDot online={isOnline(profile.last_seen_at)} />
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 justify-center">
              {profile.name || "Lumen friend"}
              {profile.is_founder && <FounderBadge />}
            </h1>
            {profile.bio && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{profile.bio}</p>}
            <p className="text-xs mt-1" style={{ color: isOnline(profile.last_seen_at) ? "#16a34a" : undefined }}>
              <span className={isOnline(profile.last_seen_at) ? "" : "text-muted-foreground"}>
                {lastSeenLabel(profile.last_seen_at)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-semibold">{posts.length}</div>
              <div className="text-xs text-muted-foreground">Posts</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{followers}</div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{following}</div>
              <div className="text-xs text-muted-foreground">Following</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFollow}
              disabled={busy || blocked}
              className="rounded-full px-6 py-2 text-sm font-medium disabled:opacity-60 transition"
              style={
                isFollowing || requestPending
                  ? { border: "1px solid var(--color-border)", background: "hsl(0 0% 100% / 0.6)" }
                  : { background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)", color: "var(--color-primary-foreground)" }
              }
            >
              {isFollowing
                ? "Following"
                : requestPending
                ? "Requested"
                : profile.is_private
                ? "Request to Follow"
                : "Follow"}
            </button>
            {!blocked && (
              <Link
                to="/messages/$id"
                params={{ id: profile.id }}
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium border border-border bg-card hover:bg-accent transition"
              >
                <MessageCircle size={15} /> Message
              </Link>
            )}
          </div>
          {blocked && (
            <p className="text-xs text-muted-foreground">
              You blocked this person. They can't message, comment on your posts, or follow you.
            </p>
          )}
        </div>
      </section>

      <section className="max-w-lg mx-auto px-4 mt-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Posts</h2>
        {profile.is_private && !isFollowing ? (
          <div className="rounded-2xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            <Sparkles size={18} className="mx-auto mb-2 text-primary" />
            This account is private. Follow to see their posts.
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No posts yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map((p) => {
              const url = p.image_url ? postUrls[p.image_url] : null;
              return (
                <div key={p.id} className="aspect-square rounded-lg overflow-hidden bg-card border border-border grid place-items-center">
                  {url ? (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <p className="text-[10px] text-muted-foreground p-2 text-center line-clamp-6">{p.caption ?? ""}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}