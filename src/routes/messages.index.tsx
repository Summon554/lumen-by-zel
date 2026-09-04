import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { isOnline } from "@/lib/presence";
import { PresenceDot } from "@/components/PresenceDot";
import { NotesBar } from "@/components/NotesBar";

export const Route = createFileRoute("/messages/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Messages — Lumen" },
      { name: "description", content: "Your Lumen conversations." },
      { property: "og:title", content: "Messages — Lumen" },
      { property: "og:description", content: "Your Lumen conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

type Convo = { id: string; name: string | null; avatar_url: string | null; last: string; at: string; last_seen_at?: string | null };
type Person = { id: string; name: string | null; avatar_url: string | null; last_seen_at?: string | null };

function MessagesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const me = auth.user.id;
      const [{ data: followingRows }, { data: followerRows }] = await Promise.all([
        (supabase as any).from("follows").select("following_id").eq("follower_id", me),
        (supabase as any).from("follows").select("follower_id").eq("following_id", me),
      ]);
      const peopleIds = Array.from(
        new Set([
          ...((followingRows ?? []) as any[]).map((r) => r.following_id),
          ...((followerRows ?? []) as any[]).map((r) => r.follower_id),
        ]),
      ).filter((x) => x !== me);

      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id,receiver_id,content,created_at")
        .order("created_at", { ascending: false })
        .limit(300);

      const latest = new Map<string, { content: string; created_at: string }>();
      (msgs ?? []).forEach((m: any) => {
        const other = m.sender_id === me ? m.receiver_id : m.sender_id;
        if (!latest.has(other)) latest.set(other, { content: m.content, created_at: m.created_at });
      });

      const ids = Array.from(latest.keys());
      const allIds = Array.from(new Set([...ids, ...peopleIds]));
      if (allIds.length === 0) {
        setConvos([]);
        setPeople([]);
        setLoading(false);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,avatar_url,last_seen_at")
        .in("id", allIds);
      const byId: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => (byId[p.id] = p));

      const rows: Convo[] = ids
        .filter((id) => byId[id])
        .map((id) => ({
          id,
          name: byId[id].name,
          avatar_url: byId[id].avatar_url,
          last_seen_at: byId[id].last_seen_at,
          last: latest.get(id)!.content,
          at: latest.get(id)!.created_at,
        }));
      rows.sort((a, b) => (a.at < b.at ? 1 : -1));
      setConvos(rows);
      setPeople(peopleIds.filter((id) => byId[id] && !ids.includes(id)).map((id) => byId[id] as Person));
      setAvatars(
        await getSignedUrls(
          (profs ?? []).map((p: any) => p.avatar_url).filter(Boolean) as string[],
        ),
      );
      setLoading(false);
    })();
  }, [navigate]);

  return (
    <main className="min-h-screen pb-16" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur bg-background/60 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/home" className="text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <span className="text-base font-semibold tracking-tight">Messages</span>
        </div>
      </header>

      <section className="max-w-lg mx-auto px-4 pt-3">
        <NotesBar />
      </section>

      <section className="max-w-lg mx-auto px-4 pt-2 space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
        {!loading && convos.length === 0 && people.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground space-y-2">
            <MessageCircle size={22} className="mx-auto text-primary" />
            <p>No conversations yet.</p>
            <Link to="/search" className="text-primary underline underline-offset-4">
              Find people to message
            </Link>
          </div>
        )}
        {convos.map((c) => {
          const av = c.avatar_url ? avatars[c.avatar_url] : undefined;
          return (
            <Link
              key={c.id}
              to="/messages/$id"
              params={{ id: c.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 backdrop-blur p-3 hover:bg-accent transition"
            >
              {av ? (
                <span className="relative">
                  <img src={av} alt="" className="h-11 w-11 rounded-full object-cover" />
                  <PresenceDot online={isOnline(c.last_seen_at)} />
                </span>
              ) : (
                <span className="relative">
                  <span
                    className="h-11 w-11 rounded-full grid place-items-center text-primary-foreground font-medium"
                    style={{ background: "var(--gradient-glow)" }}
                  >
                    {(c.name || "L").trim().charAt(0).toUpperCase()}
                  </span>
                  <PresenceDot online={isOnline(c.last_seen_at)} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name || "Lumen friend"}</p>
                <p className="text-xs text-muted-foreground truncate">{c.last}</p>
              </div>
            </Link>
          );
        })}

        {!loading && people.length > 0 && (
          <div className="pt-4 space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1">
              Find people to message
            </h2>
            {people.map((p) => {
              const av = p.avatar_url ? avatars[p.avatar_url] : undefined;
              return (
                <Link
                  key={p.id}
                  to="/messages/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-3 hover:bg-accent transition"
                >
                  <span className="relative">
                    {av ? (
                      <img src={av} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span
                        className="h-10 w-10 rounded-full grid place-items-center text-primary-foreground font-medium"
                        style={{ background: "var(--gradient-glow)" }}
                      >
                        {(p.name || "L").trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <PresenceDot online={isOnline(p.last_seen_at)} />
                  </span>
                  <p className="text-sm font-medium truncate flex-1">{p.name || "Lumen friend"}</p>
                  <span className="text-xs text-primary">Message</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
