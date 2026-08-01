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

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  is_founder: boolean | null;
  avatar_url: string | null;
  is_private: boolean | null;
};

function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) navigate({ to: "/login", replace: true });
      else {
        setMe(data.user.id);
        const [f, r] = await Promise.all([
          supabase.from("follows").select("following_id").eq("follower_id", data.user.id),
          supabase
            .from("follow_requests")
            .select("target_id")
            .eq("requester_id", data.user.id)
            .eq("status", "pending"),
        ]);
        setFollowing(new Set((f.data ?? []).map((x: any) => x.following_id)));
        setRequested(new Set((r.data ?? []).map((x: any) => x.target_id)));
      }
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
        .select("id,name,email,is_founder,avatar_url,is_private")
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(30);
      const rows = (data ?? []) as Row[];
      setResults(rows);
      const paths = rows.map((r) => r.avatar_url).filter(Boolean) as string[];
      setAvatars(await getSignedUrls(paths));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function toggleFollow(row: Row) {
    if (!me || me === row.id) return;
    setBusy(row.id);
    try {
      if (following.has(row.id)) {
        await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", row.id);
        setFollowing((s) => {
          const n = new Set(s);
          n.delete(row.id);
          return n;
        });
      } else if (row.is_private) {
        if (requested.has(row.id)) {
          await supabase.from("follow_requests").delete().eq("requester_id", me).eq("target_id", row.id);
          setRequested((s) => {
            const n = new Set(s);
            n.delete(row.id);
            return n;
          });
        } else {
          await supabase.from("follow_requests").insert({ requester_id: me, target_id: row.id });
          await supabase.from("notifications").insert({
            user_id: row.id,
            actor_id: me,
            type: "follow_request",
          });
          setRequested((s) => new Set(s).add(row.id));
        }
      } else {
        await supabase.from("follows").insert({ follower_id: me, following_id: row.id });
        await supabase.from("notifications").insert({ user_id: row.id, actor_id: me, type: "follow" });
        setFollowing((s) => new Set(s).add(row.id));
      }
    } finally {
      setBusy(null);
    }
  }

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
                <p className="text-xs text-muted-foreground truncate">
                  @{(r.email?.split("@")[0] || "lumen").toLowerCase()}
                </p>
              </div>
              {me !== r.id && (
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFollow(r);
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                    following.has(r.id) || requested.has(r.id)
                      ? "border border-border bg-card hover:bg-accent"
                      : "text-primary-foreground"
                  }`}
                  style={
                    following.has(r.id) || requested.has(r.id)
                      ? undefined
                      : { background: "var(--gradient-glow)" }
                  }
                >
                  {following.has(r.id) ? "Following" : requested.has(r.id) ? "Requested" : "Follow"}
                </button>
              )}
            </Link>
          );
        })}
      </section>
    </main>
  );
}