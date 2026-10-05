import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, MessageCircle, Share2, Volume2, VolumeX, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls, isVideoPath } from "@/lib/storage";
import { LumenAvatar } from "@/components/LumenAvatar";
import { CommentThread, type ThreadComment } from "@/components/CommentThread";

export const Route = createFileRoute("/clips")({
  head: () => ({
    meta: [
      { title: "Clips — Lumen" },
      { name: "description", content: "Swipe through glowing short videos from the Lumen community." },
      { property: "og:title", content: "Clips — Lumen" },
      { property: "og:description", content: "Swipe through glowing short videos from the Lumen community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClipsPage,
});

type Clip = { id: string; user_id: string; caption: string | null; image_url: string };
type Prof = { id: string; name: string | null; avatar_url: string | null };

function ClipsPage() {
  const [me, setMe] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Prof>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setMe(uid);
      const { data } = await supabase.from("posts").select("id,user_id,caption,image_url").not("image_url", "is", null).order("created_at", { ascending: false }).limit(200);
      const list = ((data ?? []) as Clip[]).filter((p) => isVideoPath(p.image_url)).slice(0, 50);
      setClips(list);
      const ids = [...new Set(list.map((c) => c.user_id))];
      const postIds = list.map((c) => c.id);
      const [{ data: profs }, { data: likeRows }, { data: fol }] = await Promise.all([
        ids.length ? supabase.from("profiles").select("id,name,avatar_url").in("id", ids) : Promise.resolve({ data: [] as Prof[] }),
        postIds.length ? supabase.from("likes").select("post_id,user_id").in("post_id", postIds) : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
        uid ? supabase.from("follows").select("following_id").eq("follower_id", uid) : Promise.resolve({ data: [] as { following_id: string }[] }),
      ]);
      const pm: Record<string, Prof> = {};
      (profs ?? []).forEach((p: any) => (pm[p.id] = p));
      setProfiles(pm);
      const lm: Record<string, { count: number; mine: boolean }> = {};
      (likeRows ?? []).forEach((l: any) => {
        const cur = lm[l.post_id] ?? { count: 0, mine: false };
        lm[l.post_id] = { count: cur.count + 1, mine: cur.mine || l.user_id === uid };
      });
      setLikes(lm);
      setFollowing(new Set((fol ?? []).map((f: any) => f.following_id)));
      setUrls(await getSignedUrls([...list.map((c) => c.image_url), ...((profs ?? []) as Prof[]).map((p) => p.avatar_url).filter(Boolean) as string[]]));
      setLoading(false);
    })();
  }, []);

  async function encourage(id: string, force = false) {
    if (!me) return toast.error("Sign in to encourage");
    const cur = likes[id] ?? { count: 0, mine: false };
    if (cur.mine && force) return;
    setLikes((l) => ({ ...l, [id]: { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine } }));
    const res = cur.mine
      ? await supabase.from("likes").delete().eq("post_id", id).eq("user_id", me)
      : await supabase.from("likes").insert({ post_id: id, user_id: me });
    if (res.error) { setLikes((l) => ({ ...l, [id]: cur })); toast.error(res.error.message); }
  }

  async function follow(uid: string) {
    if (!me || uid === me) return;
    const { error } = await supabase.from("follows").insert({ follower_id: me, following_id: uid });
    if (error) return toast.error("Could not follow");
    setFollowing((s) => new Set(s).add(uid));
  }

  async function share(id: string) {
    const url = `${window.location.origin}/home#${id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Lumen clip", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  }

  return (
    <main className="fixed inset-0 bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3">
        <Link to="/home" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full bg-background/50 backdrop-blur"><ArrowLeft size={20} /></Link>
        <h1 className="text-lg font-semibold text-primary drop-shadow">Clips</h1>
        <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="grid h-10 w-10 place-items-center rounded-full bg-background/50 backdrop-blur">{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
      </header>
      {!loading && !clips.length && <p className="grid h-full place-items-center text-muted-foreground">No clips yet — post a video to start ✨</p>}
      <div className="h-full snap-y snap-mandatory overflow-y-scroll" style={{ scrollbarWidth: "none" }}>
        {clips.map((c) => (
          <ClipItem
            key={c.id}
            clip={c}
            src={urls[c.image_url]}
            muted={muted}
            author={profiles[c.user_id]}
            avatar={profiles[c.user_id]?.avatar_url ? urls[profiles[c.user_id]!.avatar_url!] : undefined}
            like={likes[c.id] ?? { count: 0, mine: false }}
            canFollow={!!me && c.user_id !== me && !following.has(c.user_id)}
            onFollow={() => follow(c.user_id)}
            onEncourage={(force) => encourage(c.id, force)}
            onComments={() => setCommentsFor(c.id)}
            onShare={() => share(c.id)}
          />
        ))}
      </div>
      {commentsFor && <ClipComments postId={commentsFor} me={me} authorId={clips.find((c) => c.id === commentsFor)!.user_id} onClose={() => setCommentsFor(null)} />}
    </main>
  );
}

function ClipItem({ clip, src, muted, author, avatar, like, canFollow, onFollow, onEncourage, onComments, onShare }: {
  clip: Clip; src?: string; muted: boolean; author?: Prof; avatar?: string; like: { count: number; mine: boolean }; canFollow: boolean;
  onFollow: () => void; onEncourage: (force: boolean) => void; onComments: () => void; onShare: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio > 0.6) void v.play().catch(() => {}); else v.pause(); }, { threshold: [0, 0.6, 1] });
    io.observe(v);
    return () => io.disconnect();
  }, [src]);

  function tap() {
    const now = Date.now();
    if (now - lastTap.current < 300) { onEncourage(true); setBurst((b) => b + 1); }
    lastTap.current = now;
  }

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-background">
      {src ? <video ref={ref} src={src} muted={muted} loop playsInline preload="metadata" onClick={tap} className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-muted-foreground">Loading…</div>}
      {burst > 0 && <Heart key={burst} size={110} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 fill-primary text-primary animate-ping" style={{ animationIterationCount: 1, filter: "drop-shadow(0 0 24px var(--color-primary))" }} />}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-5">
        <Link to="/u/$id" params={{ id: clip.user_id }} className="relative" aria-label={`${author?.name ?? "Author"} profile`}>
          <LumenAvatar name={author?.name} url={avatar} size={48} />
          {canFollow && <button onClick={(e) => { e.preventDefault(); onFollow(); }} aria-label="Follow" className="absolute -bottom-2 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground"><Plus size={12} /></button>}
        </Link>
        <ActionBtn label="Encourage" onClick={() => onEncourage(false)}><Heart size={28} className={like.mine ? "fill-primary text-primary" : ""} /><span>{like.count}</span></ActionBtn>
        <ActionBtn label="Comments" onClick={onComments}><MessageCircle size={28} /></ActionBtn>
        <ActionBtn label="Share" onClick={onShare}><Share2 size={28} /></ActionBtn>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background/90 to-transparent p-4 pr-20 pb-8">
        <p className="font-semibold">{author?.name || "Lumen friend"}</p>
        {clip.caption && <p className="mt-1 line-clamp-3 text-sm text-foreground/90">{clip.caption}</p>}
      </div>
    </section>
  );
}

function ActionBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-label={label} className="flex flex-col items-center gap-1 text-xs text-foreground drop-shadow">{children}</button>;
}

function ClipComments({ postId, me, authorId, onClose }: { postId: string; me: string | null; authorId: string; onClose: () => void }) {
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at");
      const list = (data ?? []) as ThreadComment[];
      setComments(list);
      const ids = [...new Set(list.map((c: any) => c.user_id))];
      if (!ids.length) return;
      const { data: p } = await supabase.from("profiles").select("id,name,is_founder,avatar_url").in("id", ids);
      const m: Record<string, any> = {};
      (p ?? []).forEach((x) => (m[x.id] = x));
      setProfiles(m);
      setAvatars(await getSignedUrls((p ?? []).map((x) => x.avatar_url).filter(Boolean) as string[]));
    })();
  }, [postId]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-background/60" onClick={onClose} role="dialog" aria-label="Comments">
      <div className="max-h-[70dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
        <CommentThread postId={postId} postAuthorId={authorId} meId={me} comments={comments} likes={{}} profiles={profiles} avatarLookup={avatars} onLocalAdd={(c) => setComments((x) => [...x, c])} onLocalLikeChange={() => {}} />
      </div>
    </div>
  );
}
