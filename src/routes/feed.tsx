import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Sparkles } from "lucide-react";

export const Route = createFileRoute("/feed")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your feed — Lumen" },
      { name: "description", content: "Your Lumen feed." },
      { property: "og:title", content: "Your feed — Lumen" },
      { property: "og:description", content: "Your Lumen feed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setEmail(data.user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", data.user.id)
        .maybeSingle();
      setName(profile?.name || (data.user.user_metadata?.name as string) || "friend");
      setLoading(false);
    })();
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  }

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--gradient-bg)" }}
      >
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-6 py-10 flex flex-col"
      style={{ background: "var(--gradient-bg)" }}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-full grid place-items-center text-primary-foreground"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            <Sparkles size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Lumen</span>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 backdrop-blur px-3.5 py-1.5 text-sm text-foreground hover:bg-accent transition"
        >
          <LogOut size={14} /> Logout
        </button>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <div
          className="h-24 w-24 rounded-full grid place-items-center"
          style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
        >
          <Sparkles className="text-primary-foreground" size={44} />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Welcome to{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--gradient-glow)" }}
          >
            Lumen
          </span>{" "}
          {name}
        </h1>
        <p className="text-muted-foreground max-w-sm">
          You're signed in as <span className="text-foreground">{email}</span>. Your
          feed will glow here soon.
        </p>
      </section>
    </main>
  );
}
