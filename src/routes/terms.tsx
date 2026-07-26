import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Lumen" },
      { name: "description", content: "The rules that keep Lumen kind and safe." },
      { property: "og:title", content: "Terms of Service — Lumen" },
      { property: "og:description", content: "The rules that keep Lumen kind and safe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-10" style={{ background: "var(--gradient-bg)" }}>
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <div
            className="h-9 w-9 rounded-full grid place-items-center text-primary-foreground"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            <Sparkles size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Lumen</span>
        </Link>

        <article className="rounded-3xl border border-border bg-card/70 backdrop-blur p-6 sm:p-8 space-y-5">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: today</p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Be kind</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Lumen is a place for light. No harassment, hate speech, threats, or
              content that hurts other people. Share hope, glow moments, and real
              stories — treat everyone with respect.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">You must be 13 or older</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By creating an account you confirm you're at least 13 years old.
              Accounts belonging to younger users will be removed.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Your content</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You own what you post. By posting, you give Lumen permission to
              display it to people you share it with. Don't post anything you
              don't have the right to share.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Ending your account</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can delete your account at any time. We may remove accounts
              that break these rules to keep Lumen a bright place for everyone.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}