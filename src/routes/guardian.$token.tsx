import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, AlertCircle } from "lucide-react";
import { verifyGuardianToken } from "@/lib/guardian.functions";

export const Route = createFileRoute("/guardian/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guardian verification — Lumen" },
      { name: "description", content: "Confirm consent for a young person's Lumen account." },
      { property: "og:title", content: "Guardian verification — Lumen" },
      { property: "og:description", content: "Confirm consent for a young person's Lumen account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuardianPage,
});

const COPY: Record<string, { title: string; body: string; ok: boolean }> = {
  ok: {
    title: "Thank you — consent confirmed",
    body: "The account is now fully active. You can withdraw consent at any time by contacting us or deleting the account.",
    ok: true,
  },
  already: { title: "Already confirmed", body: "This account has already been verified. Nothing more to do.", ok: true },
  expired: {
    title: "This link has expired",
    body: "Verification links last 7 days. Ask the account holder to send a fresh one from their settings.",
    ok: false,
  },
  invalid: { title: "We couldn't find this link", body: "The link may be mistyped or no longer valid.", ok: false },
  error: { title: "Something went wrong", body: "Please try the link again in a moment.", ok: false },
};

function GuardianPage() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    verifyGuardianToken({ data: { token } })
      .then((r) => setStatus(r.status))
      .catch(() => setStatus("error"));
  }, [token]);

  const copy = status ? COPY[status] ?? COPY.error : null;

  return (
    <main className="min-h-screen px-6 py-10 grid place-items-center" style={{ background: "var(--gradient-bg)" }}>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/70 backdrop-blur p-8 space-y-4 text-center">
        <div
          className="h-12 w-12 mx-auto rounded-full grid place-items-center text-primary-foreground"
          style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
        >
          <Sparkles size={22} />
        </div>
        {!copy ? (
          <p className="text-sm text-muted-foreground">Checking your link…</p>
        ) : (
          <>
            <div className="flex justify-center text-primary">
              {copy.ok ? <ShieldCheck size={22} /> : <AlertCircle size={22} className="text-destructive" />}
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{copy.body}</p>
          </>
        )}
        <Link to="/" className="inline-block text-sm text-primary underline underline-offset-4">
          Go to Lumen
        </Link>
      </div>
    </main>
  );
}