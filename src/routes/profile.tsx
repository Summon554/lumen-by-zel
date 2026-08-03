import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Camera, ImagePlus, Sparkles } from "lucide-react";
import { getSignedUrl, getSignedUrls, uploadUserFile } from "@/lib/storage";
import { isFounder } from "@/lib/founder";
import { FounderBadge } from "@/components/FounderBadge";
import { HamburgerMenu } from "@/components/HamburgerMenu";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profile — Lumen" },
      { name: "description", content: "Your Lumen profile." },
      { property: "og:title", content: "Profile — Lumen" },
      { property: "og:description", content: "Your Lumen profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type Post = { id: string; image_url: string | null; caption: string | null; created_at: string };
type ProfileTab = "posts" | "media" | "likes" | "encouragements";

function Count({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-baseline gap-1 hover:opacity-70 transition"
    >
      <span className="font-bold" style={{ fontSize: 14 }}>{value}</span>
      <span className="text-muted-foreground font-normal" style={{ fontSize: 14 }}>{label}</span>
    </button>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postUrls, setPostUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [friends, setFriends] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<"personal" | "professional">("personal");
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [tabPosts, setTabPosts] = useState<Post[]>([]);
  const [tabUrls, setTabUrls] = useState<Record<string, string>>({});
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    if (!userId || tab === "posts" || tab === "media") return;
    let cancelled = false;
    (async () => {
      setTabLoading(true);
      const table = tab === "likes" ? "likes" : "reactions";
      const { data: rows } = await (supabase as any)
        .from(table)
        .select("post_id")
        .eq("user_id", userId)
        .limit(60);
      const ids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.post_id)));
      if (!ids.length) {
        if (!cancelled) {
          setTabPosts([]);
          setTabUrls({});
          setTabLoading(false);
        }
        return;
      }
      const { data: postRows } = await supabase
        .from("posts")
        .select("id,image_url,caption,created_at")
        .in("id", ids)
        .order("created_at", { ascending: false });
      const list = (postRows ?? []) as Post[];
      const urls = await getSignedUrls(list.map((p) => p.image_url).filter(Boolean) as string[]);
      if (cancelled) return;
      setTabPosts(list);
      setTabUrls(urls);
      setTabLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, userId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);
      const [{ data: profile }, { data: postRows }, followersRes, followingRes, followerIdsRes, followingIdsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle(),
        supabase
          .from("posts")
          .select("id,image_url,caption,created_at")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false })
          .limit(9),
        (supabase as any).from("follows").select("*", { count: "exact", head: true }).eq("following_id", data.user.id),
        (supabase as any).from("follows").select("*", { count: "exact", head: true }).eq("follower_id", data.user.id),
        (supabase as any).from("follows").select("follower_id").eq("following_id", data.user.id),
        (supabase as any).from("follows").select("following_id").eq("follower_id", data.user.id),
      ]);
      setName(profile?.name ?? "");
      setBio(profile?.bio ?? "");
      setAvatarPath(profile?.avatar_url ?? null);
      setIsPrivate(Boolean((profile as any)?.is_private));
      setAccountType(((profile as any)?.account_type === "professional" ? "professional" : "personal"));
      if (profile?.avatar_url) setAvatarUrl(await getSignedUrl(profile.avatar_url));
      if ((profile as any)?.cover_url) setCoverUrl(await getSignedUrl((profile as any).cover_url));
      const list = (postRows ?? []) as Post[];
      setPosts(list);
      const paths = list.map((p) => p.image_url).filter(Boolean) as string[];
      setPostUrls(await getSignedUrls(paths));
      setFollowers(followersRes.count ?? 0);
      setFollowing(followingRes.count ?? 0);
      const followerIds = new Set(((followerIdsRes.data ?? []) as any[]).map((r) => r.follower_id));
      const mutual = ((followingIdsRes.data ?? []) as any[]).filter((r) => followerIds.has(r.following_id));
      setFriends(mutual.length);
      setLoading(false);
    })();
  }, [navigate]);

  async function handleAvatar(file: File) {
    if (!userId) return;
    try {
      const path = await uploadUserFile(userId, file, "avatars");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (error) throw error;
      setAvatarPath(path);
      setAvatarUrl(await getSignedUrl(path));
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() || null, bio: bio.trim() || null })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
    setEditing(false);
  }

  async function handleCover(file: File) {
    if (!userId) return;
    try {
      const path = await uploadUserFile(userId, file, "covers");
      const { error } = await (supabase as any).from("profiles").update({ cover_url: path }).eq("id", userId);
      if (error) throw error;
      setCoverUrl(await getSignedUrl(path));
      toast.success("Cover updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center" style={{ background: "var(--gradient-bg)" }}>
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </main>
    );
  }

  const founder = isFounder(email);
  const username = (email?.split("@")[0] || "lumen").toLowerCase();

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

      <section className="max-w-lg mx-auto">
        {/* Cover photo — layered aurora glow, unique to Lumen */}
        <div className="relative h-36 sm:h-44 overflow-hidden rounded-b-[2rem] border-b border-border">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }}>
              <div className="absolute -top-10 -left-6 h-32 w-32 rounded-full bg-white/40 blur-2xl animate-float" />
              <div className="absolute top-4 right-2 h-28 w-28 rounded-full bg-white/25 blur-2xl animate-pulse-glow" />
              <div className="absolute bottom-[-2rem] left-1/3 h-32 w-40 rounded-full bg-primary/40 blur-3xl" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
          <button
            onClick={() => coverRef.current?.click()}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-card/80 border border-border backdrop-blur hover:bg-accent transition"
            aria-label="Change cover photo"
          >
            <ImagePlus size={14} /> Cover
          </button>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCover(e.target.files[0])}
          />
        </div>

        <div className="px-4 pt-4">
          {/* Profile header row: 80px photo + text, 16px gap */}
          <div className="flex items-center" style={{ gap: 16 }}>
            <div className="relative shrink-0">
              <div
                className="rounded-full overflow-hidden grid place-items-center text-primary-foreground text-2xl font-medium border-4 border-background"
                style={{ height: 80, width: 80, background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (name || "L").trim().charAt(0).toUpperCase()
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full grid place-items-center bg-card border border-border shadow-lg hover:bg-accent transition"
                aria-label="Change photo"
              >
                <Camera size={14} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-bold flex items-center gap-2" style={{ fontSize: 18 }}>
                <span className="truncate">{name || "Lumen friend"}</span>
                {founder && <FounderBadge />}
              </h1>
              <p className="text-muted-foreground truncate" style={{ fontSize: 14 }}>
                @{username}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                {accountType === "personal" ? (
                  <>
                    <Count label="Friends" value={friends} />
                    <Count label="Posts" value={posts.length} />
                  </>
                ) : (
                  <>
                    <Count label="Followers" value={followers} />
                    <Count label="Following" value={following} />
                    <Count label="Posts" value={posts.length} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mt-5 flex flex-col items-center text-center gap-4">
          {!editing ? (
            <>
              {bio && <p className="text-sm text-muted-foreground max-w-xs">{bio}</p>}

              <button
                onClick={() => setEditing(true)}
                className="rounded-full px-4 py-1.5 text-sm border border-border bg-card/70 hover:bg-accent transition"
              >
                Edit Profile
              </button>

              <div className="w-full max-w-sm rounded-2xl border border-border bg-card/70 backdrop-blur p-4 flex items-center gap-3 text-left">
                <div className="h-9 w-9 rounded-full grid place-items-center bg-background/70 border border-border">
                  <UserCog size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Account Type</p>
                  <p className="text-xs text-muted-foreground">Changes what counts show on your header.</p>
                </div>
                <div className="flex rounded-full border border-border overflow-hidden text-xs">
                  {(["personal", "professional"] as const).map((t) => (
                    <button
                      key={t}
                      disabled={savingType}
                      onClick={() => changeAccountType(t)}
                      className={`px-3 py-1.5 transition ${accountType === t ? "text-primary-foreground" : "hover:bg-accent"}`}
                      style={accountType === t ? { background: "var(--gradient-glow)" } : undefined}
                    >
                      {t === "personal" ? "Personal" : "Pro"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-sm mt-2 rounded-2xl border border-border bg-card/70 backdrop-blur p-4 flex items-center gap-3 text-left">
                <div className="h-9 w-9 rounded-full grid place-items-center bg-background/70 border border-border">
                  <Lock size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Private Account</p>
                  <p className="text-xs text-muted-foreground">
                    When on, others must send a follow request.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isPrivate}
                    disabled={savingPrivacy}
                    onChange={(e) => togglePrivacy(e.target.checked)}
                  />
                  <span
                    className="w-11 h-6 rounded-full bg-muted peer-checked:[background:var(--gradient-glow)] transition"
                  />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </label>
              </div>

              {userId && <NotificationSettings userId={userId} />}
            </>
          ) : (
            <div className="w-full max-w-sm space-y-3 text-left">
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted-foreground mb-1.5 block">Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={200}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </label>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-full px-4 py-1.5 text-sm border border-border bg-card/70 hover:bg-accent transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full px-4 py-1.5 text-sm text-primary-foreground font-medium disabled:opacity-60"
                  style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
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
                <div
                  key={p.id}
                  className="aspect-square rounded-lg overflow-hidden bg-card border border-border grid place-items-center"
                >
                  {url ? (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <p className="text-[10px] text-muted-foreground p-2 text-center line-clamp-6">
                      {p.caption ?? ""}
                    </p>
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