import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { INDEPENDENCE_DISCLAIMER, LEGAL_CONTACT, LEGAL_VERSIONS } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Lumen" },
      { name: "description", content: "How Lumen collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Policy — Lumen" },
      { property: "og:description", content: "How Lumen collects, uses, and protects your data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Version {LEGAL_VERSIONS.privacy} · Philippine Data Privacy Act of 2012 (RA 10173)
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Who we are</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{INDEPENDENCE_DISCLAIMER}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What we collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To run your Lumen account we store the email and name you provide, plus content
              you choose to share — profile photo, bio, posts, likes, and comments.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">How we use it</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is used only to power the Lumen experience: signing you in,
              displaying your feed, and letting you connect with the people you invite.
              We don't sell it or share it with advertisers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Your control</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can edit your profile, delete your posts, download a full JSON copy of your
              data, or delete your account at any time from{" "}
              <Link to="/account" className="text-foreground underline underline-offset-4">
                Your data &amp; account
              </Link>
              . Deletion has a 7-day undo window, after which your profile, posts, likes,
              comments, reactions, and messages are permanently erased.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Young people</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Lumen is for ages 13 and up. Accounts belonging to anyone under 18 require a parent
              or guardian to confirm consent through a verification link we email them. Until
              that confirmation arrives, the account cannot receive messages from strangers and
              its posts are limited to followers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Changes to this policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Each policy carries a version. When we publish a new version, you'll be asked to
              review and consent again before you continue using Lumen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Questions? Reach us at{" "}
              <a href={`mailto:${LEGAL_CONTACT}`} className="text-foreground underline underline-offset-4">
                {LEGAL_CONTACT}
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}