import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ChevronRight, Users, Heart, Sun } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Welcome to Lumen" },
      { name: "description", content: "Connect with people who matter. Share moments and encouragement. Build a positive community on Lumen." },
      { property: "og:title", content: "Welcome to Lumen" },
      { property: "og:description", content: "Connect. Share. Grow together on Lumen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const SLIDES = [
  {
    icon: Users,
    title: "Connect with people who matter to you",
    body: "Find your family, closest friends, and the people who lift you up.",
  },
  {
    icon: Heart,
    title: "Share moments, thoughts, and encouragement",
    body: "Post a photo, drop a kind word, celebrate the everyday.",
  },
  {
    icon: Sun,
    title: "Build a positive community together",
    body: "A calm, welcoming space — for everyone, without the noise.",
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home", replace: true });
      else setLoading(false);
    });
  }, [navigate]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-bg)" }}>
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </main>
    );
  }

  const S = SLIDES[slide];
  const Icon = S.icon;
  const isLast = slide === SLIDES.length - 1;

  return (
    <main
      className="relative min-h-screen overflow-hidden flex flex-col px-6 py-8"
      style={{ background: "var(--gradient-bg)" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-pulse-glow" />
        <div className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-primary-glow/20 blur-3xl animate-pulse-glow" style={{ animationDelay: "2s" }} />
        <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-pulse-glow" style={{ animationDelay: "4s" }} />
      </div>

      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-full grid place-items-center text-primary-foreground"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            <Sparkles size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Lumen</span>
        </div>
        {!isLast && (
          <button
            onClick={() => setSlide(SLIDES.length - 1)}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            Skip
          </button>
        )}
      </header>

      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto w-full">
        <div
          className="h-24 w-24 rounded-full grid place-items-center mb-8 animate-float"
          style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
        >
          <Icon size={44} className="text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {S.title}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">{S.body}</p>

        <div className="mt-8 flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="h-2 rounded-full transition-all"
              style={{
                width: i === slide ? 24 : 8,
                background: i === slide ? "var(--gradient-glow)" : "hsl(0 0% 60% / 0.35)",
              }}
            />
          ))}
        </div>
      </section>

      <div className="relative z-10 max-w-sm mx-auto w-full space-y-3">
        {!isLast ? (
          <button
            onClick={() => setSlide((s) => Math.min(SLIDES.length - 1, s + 1))}
            className="w-full inline-flex items-center justify-center gap-1 rounded-2xl py-4 text-base font-medium text-primary-foreground transition hover:opacity-90"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            Next <ChevronRight size={18} />
          </button>
        ) : (
          <>
            <Link
              to="/signup"
              className="w-full inline-flex items-center justify-center rounded-2xl py-4 text-base font-semibold text-primary-foreground transition hover:opacity-90"
              style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center rounded-2xl py-3 text-sm font-medium text-foreground border border-border bg-card/60 backdrop-blur hover:bg-accent transition"
            >
              I already have an account
            </Link>
          </>
        )}
      </div>
    </main>
  );
}