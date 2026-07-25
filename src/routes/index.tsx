import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lumen — Where your feed glows" },
      { name: "description", content: "Connect. Share. Glow together on Lumen." },
      { property: "og:title", content: "Lumen — Where your feed glows" },
      { property: "og:description", content: "Connect. Share. Glow together on Lumen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: "/feed", replace: true });
      } else {
        setLoading(false);
      }
    });
  }, [navigate]);

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
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-6 py-10 text-center"
      style={{ background: "var(--gradient-bg)" }}
    >
      {/* Subtle animated glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-pulse-glow"
        />
        <div
          className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-primary-glow/20 blur-3xl animate-pulse-glow"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-pulse-glow"
          style={{ animationDelay: "4s" }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm">
        <div
          className="h-24 w-24 sm:h-28 sm:w-28 rounded-full grid place-items-center animate-float"
          style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
        >
          <Sparkles className="text-primary-foreground" size={56} />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Lumen — Where your feed glows
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Connect. Share. Glow together.
          </p>
        </div>

        <div className="flex flex-col w-full gap-3">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-xl py-3 text-base font-medium text-primary-foreground transition hover:opacity-90"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            Sign Up
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl py-3 text-base font-medium text-foreground transition border border-border bg-card/60 backdrop-blur hover:bg-accent"
          >
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}
