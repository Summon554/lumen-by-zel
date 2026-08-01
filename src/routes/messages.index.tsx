import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { ArrowLeft, MessageCircle } from "lucide-react";

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

type Convo = { id: string; name: string | null; avatar_url: string | null; last: string; at: string };

function MessagesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const me = auth.user.id;
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
      if (ids.length === 0) {
        setConvos([]);
        setLoading(false);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,avatar_url")
        .in("id", ids);
      const rows: Convo[] = (profs ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        last: latest.get(p.id)!.content,
        at: latest.get(p.id)!.created_at,
      }));
      rows.sort((a, b) => (a.at < b.at ? 1 : -1));
      setConvos(rows);
      setAvatars(await getSignedUrls(rows.map((r) => r.avatar_url).filter(Boolean) as string[]));
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

      <section className="max-w-lg mx-auto px-4 pt-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
        {!loading && convos.length === 0 && (
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
                <img src={av} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div
                  className="h-11 w-11 rounded-full grid place-items-center text-primary-foreground font-medium"
                  style={{ background: "var(--gradient-glow)" }}
                >
                  {(c.name || "L").trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name || "Lumen friend"}</p>
                <p className="text-xs text-muted-foreground truncate">{c.last}</p>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
