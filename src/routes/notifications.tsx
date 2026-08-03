import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { ArrowLeft, Bell, Heart, MessageCircle, UserPlus } from "lucide-react";
import { isFounder } from "@/lib/founder";
import { FounderBadge } from "@/components/FounderBadge";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications — Lumen" },
      { name: "description", content: "Your Lumen activity." },
      { property: "og:title", content: "Notifications — Lumen" },
      { property: "og:description", content: "Your Lumen activity." },
    ],
  }),
  component: NotificationsPage,
});

type Notif = {
  id: string;
  user_id: string;
  actor_id: string;
  type: "like" | "follow" | "follow_request" | "comment" | "comment_reply" | "comment_like";
  post_id: string | null;
  read: boolean;
  created_at: string;
};
type Profile = { id: string; name: string | null; email: string | null; avatar_url: string | null };

function NotificationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notif[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (data ?? []) as Notif[];
      setItems(list);

      const actorIds = Array.from(new Set(list.map((n) => n.actor_id)));
      if (actorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,name,email,avatar_url")
          .in("id", actorIds);
        const map: Record<string, Profile> = {};
        (profs ?? []).forEach((p) => (map[p.id] = p as Profile));
        setProfiles(map);
        const paths = (profs ?? []).map((p) => p.avatar_url).filter(Boolean) as string[];
        setAvatars(await getSignedUrls(paths));
      }

      // mark as read
      const unread = list.filter((n) => !n.read).map((n) => n.id);
      if (unread.length) {
        await (supabase as any).from("notifications").update({ read: true }).in("id", unread);
      }
      setLoading(false);
    })();
  }, [navigate]);

  return (
    <main className="min-h-screen pb-16" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur bg-background/60 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Home
          </Link>
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <span className="text-base font-semibold tracking-tight">Notifications</span>
          </div>
          <span className="w-14" />
        </div>
      </header>

      <section className="max-w-lg mx-auto px-4 pt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell size={22} />}
            title="Nothing yet"
            body="Encouragements, comments and new followers will show up here as soon as they happen."
          />
        ) : (
          items.map((n) => {
            const actor = profiles[n.actor_id];
            const av = actor?.avatar_url ? avatars[actor.avatar_url] : undefined;
            return (
              <Link
                key={n.id}
                to="/u/$id"
                params={{ id: n.actor_id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 backdrop-blur p-3 hover:bg-accent transition"
              >
                {av ? (
                  <img src={av} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <div className="h-11 w-11 rounded-full grid place-items-center text-primary-foreground font-medium" style={{ background: "var(--gradient-glow)" }}>
                    {(actor?.name || "L").trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">
                    <span className="font-medium">{actor?.name || "Someone"}</span>{" "}
                    {isFounder(actor?.email) && <FounderBadge size={12} showLabel={false} />}{" "}
                    <span className="text-muted-foreground">
                      {labelFor(n.type)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                {iconFor(n.type)}
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}

function labelFor(t: Notif["type"]) {
  switch (t) {
    case "like":
      return "liked your post";
    case "follow":
      return "started following you";
    case "follow_request":
      return "requested to follow you";
    case "comment":
      return "commented on your post";
    case "comment_reply":
      return "replied to your comment";
    case "comment_like":
      return "liked your comment";
  }
}

function iconFor(t: Notif["type"]) {
  if (t === "like" || t === "comment_like") return <Heart size={16} className="text-primary" />;
  if (t === "comment" || t === "comment_reply") return <MessageCircle size={16} className="text-primary" />;
  return <UserPlus size={16} className="text-primary" />;
}