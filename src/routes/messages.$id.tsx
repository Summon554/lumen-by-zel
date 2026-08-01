import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/messages/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat — Lumen" },
      { name: "description", content: "Send a direct message on Lumen." },
      { property: "og:title", content: "Chat — Lumen" },
      { property: "og:description", content: "Send a direct message on Lumen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Msg = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };

function ChatPage() {
  const { id: otherId } = Route.useParams();
  const navigate = useNavigate();
  const endRef = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<string | null>(null);
  const [other, setOther] = useState<{ name: string | null; avatar: string | null } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(meId: string) {
    const { data } = await supabase
      .from("messages")
      .select("id,sender_id,receiver_id,content,created_at")
      .or(
        `and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`,
      )
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs((data ?? []) as Msg[]);
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setMe(auth.user.id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("name,avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      setOther({
        name: prof?.name ?? null,
        avatar: prof?.avatar_url ? await getSignedUrl(prof.avatar_url) : null,
      });
      await load(auth.user.id);
      setLoading(false);

      channel = supabase
        .channel(`dm-${auth.user.id}-${otherId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const m = payload.new as Msg;
            const mine = auth.user!.id;
            const inThread =
              (m.sender_id === mine && m.receiver_id === otherId) ||
              (m.sender_id === otherId && m.receiver_id === mine);
            if (inThread) setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [otherId, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!me || !content) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: me, receiver_id: otherId, content })
      .select("id,sender_id,receiver_id,content,created_at")
      .maybeSingle();
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    if (data) setMsgs((prev) => (prev.some((x) => x.id === (data as Msg).id) ? prev : [...prev, data as Msg]));
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur bg-background/60 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/messages" className="text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          {other?.avatar ? (
            <img src={other.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div
              className="h-8 w-8 rounded-full grid place-items-center text-primary-foreground text-xs font-medium"
              style={{ background: "var(--gradient-glow)" }}
            >
              {(other?.name || "L").trim().charAt(0).toUpperCase()}
            </div>
          )}
          <Link to="/u/$id" params={{ id: otherId }} className="text-sm font-semibold truncate">
            {other?.name || "Lumen friend"}
          </Link>
        </div>
      </header>

      <section className="flex-1 max-w-lg w-full mx-auto px-4 py-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
        {!loading && msgs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Say hello 👋</p>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "text-primary-foreground" : "bg-card border border-border"
                }`}
                style={mine ? { background: "var(--gradient-glow)" } : undefined}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </section>

      <form
        onSubmit={send}
        className="sticky bottom-0 backdrop-blur bg-background/70 border-t border-border"
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            maxLength={1000}
            className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="h-9 w-9 rounded-full grid place-items-center text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </main>
  );
}
