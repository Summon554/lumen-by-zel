import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { FounderBadge } from "@/components/FounderBadge";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/search")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Search — Lumen" },
      { name: "description", content: "Find people on Lumen." },
      { property: "og:title", content: "Search — Lumen" },
      { property: "og:description", content: "Find people on Lumen." },
    ],
  }),
  component: SearchPage,
});

type Row = { id: string; name: string | null; is_founder: boolean | null; avatar_url: string | null };

function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/login", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) {
        setResults([]);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id,name,is_founder,avatar_url")
        .ilike("name", `%${term}%`)
        .limit(30);
      const rows = (data ?? []) as Row[];
      setResults(rows);
      const paths = rows.map((r) => r.avatar_url).filter(Boolean) as string[];
      setAvatars(await getSignedUrls(paths));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <main className="min-h-screen pb-16" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur bg-background/60 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/home" className="text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 relative">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people by name"
              className="w-full rounded-full border border-border bg-card pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </header>

      <section className="max-w-lg mx-auto px-4 pt-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Searching…</p>}
        {!loading && q && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No people found.</p>
        )}
        {results.map((r) => {
          const av = r.avatar_url ? avatars[r.avatar_url] : undefined;
          return (
            <Link
              key={r.id}
              to="/u/$id"
              params={{ id: r.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 backdrop-blur p-3 hover:bg-accent transition"
            >
              {av ? (
                <img src={av} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div
                  className="h-11 w-11 rounded-full grid place-items-center text-primary-foreground font-medium"
                  style={{ background: "var(--gradient-glow)" }}
                >
                  {(r.name || "L").trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium flex items-center gap-1.5 truncate">
                  {r.name || "Lumen friend"}
                  {r.is_founder && <FounderBadge size={12} showLabel={false} />}
                </p>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}