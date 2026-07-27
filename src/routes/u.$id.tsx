import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getSignedUrl, getSignedUrls } from "@/lib/storage";
import { isFounder } from "@/lib/founder";
import { FounderBadge } from "@/components/FounderBadge";

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
type Profile = { id: string; name: string | null; bio: string | null; email: string | null; avatar_url: string | null };

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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const [{ data: prof }, { data: postRows }, followersRes, followingRes, meFollowsRes] = await Promise.all([
        supabase.from("profiles").select("id,name,bio,email,avatar_url").eq("id", id).maybeSingle(),
        supabase.from("posts").select("id,image_url,caption,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(9),
        (supabase as any).from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
        (supabase as any).from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
        (supabase as any).from("follows").select("id").eq("follower_id", auth.user.id).eq("following_id", id).maybeSingle(),
      ]);
      setProfile(prof as Profile | null);
      if (prof?.avatar_url) setAvatarUrl(await getSignedUrl(prof.avatar_url));
      const list = (postRows ?? []) as Post[];
      setPosts(list);
      setPostUrls(await getSignedUrls(list.map((p) => p.image_url).filter(Boolean) as string[]));
      setFollowers(followersRes.count ?? 0);
      setFollowing(followingRes.count ?? 0);
      setIsFollowing(!!meFollowsRes.data);
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
          <span className="w-10" />
        </div>
      </header>

      <section className="max-w-lg mx-auto px-4 pt-8">
        <div className="flex flex-col items-center text-center gap-4">
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

          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 justify-center">
              {profile.name || "Lumen friend"}
              {isFounder(profile.email) && <FounderBadge />}
            </h1>
            {profile.bio && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{profile.bio}</p>}
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

          <button
            onClick={toggleFollow}
            disabled={busy}
            className="rounded-full px-6 py-2 text-sm font-medium disabled:opacity-60 transition"
            style={
              isFollowing
                ? { border: "1px solid var(--color-border)", background: "hsl(0 0% 100% / 0.6)" }
                : { background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)", color: "var(--color-primary-foreground)" }
            }
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        </div>
      </section>

      <section className="max-w-lg mx-auto px-4 mt-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Posts</h2>
        {posts.length === 0 ? (
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