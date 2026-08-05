import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Music, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LEGAL_CONTACT } from "@/lib/legal";

export const Route = createFileRoute("/takedown")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Music Takedown Request — Lumen" },
      { name: "description", content: "Report copyrighted music used on Lumen and request its removal." },
      { property: "og:title", content: "Music Takedown Request — Lumen" },
      { property: "og:description", content: "Report copyrighted music used on Lumen and request its removal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TakedownPage,
});

function TakedownPage() {
  const [form, setForm] = useState({
    requester_name: "",
    requester_email: "",
    work_title: "",
    content_url: "",
    rights_statement: "",
    details: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("takedown_requests").insert({
      ...form,
      content_url: form.content_url.trim() || null,
      details: form.details.trim() || null,
      requester_id: auth.user?.id ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <main className="min-h-screen px-6 py-10" style={{ background: "var(--gradient-bg)" }}>
      <div className="max-w-xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <div
            className="h-9 w-9 rounded-full grid place-items-center text-primary-foreground"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            <Sparkles size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Lumen</span>
        </Link>

        <div className="rounded-3xl border border-border bg-card/70 backdrop-blur p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <Music size={20} className="text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Music takedown request</h1>
          </div>

          {done ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your request has been logged and is queued for review. We'll reach you at{" "}
                <span className="text-foreground">{form.requester_email}</span> once it's resolved.
              </p>
              <Link
                to="/home"
                className="inline-block rounded-full px-5 py-2.5 text-sm font-medium text-primary-foreground"
                style={{ background: "var(--gradient-glow)" }}
              >
                Back to Lumen
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Lumen only allows 15-second clips from its own public-domain library, and that limit is
                enforced on our servers. If you still believe music on Lumen infringes your rights, tell
                us here.
              </p>
              <form onSubmit={submit} className="space-y-3">
                <Field label="Your name" value={form.requester_name} onChange={(v) => set("requester_name", v)} />
                <Field
                  label="Your email"
                  type="email"
                  value={form.requester_email}
                  onChange={(v) => set("requester_email", v)}
                />
                <Field label="Title of the work" value={form.work_title} onChange={(v) => set("work_title", v)} />
                <Field
                  label="Link to the content on Lumen (optional)"
                  required={false}
                  value={form.content_url}
                  onChange={(v) => set("content_url", v)}
                />
                <Field
                  label="Statement of your rights to this work"
                  value={form.rights_statement}
                  onChange={(v) => set("rights_statement", v)}
                  multiline
                />
                <Field
                  label="Anything else (optional)"
                  required={false}
                  value={form.details}
                  onChange={(v) => set("details", v)}
                  multiline
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  style={{ background: "var(--gradient-glow)" }}
                >
                  {busy ? "Sending…" : "Submit request"}
                </button>
              </form>
              <p className="text-xs text-muted-foreground">
                Prefer email? Write to{" "}
                <a href={`mailto:${LEGAL_CONTACT}`} className="text-foreground underline underline-offset-4">
                  {LEGAL_CONTACT}
                </a>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground mb-1.5 block">{label}</span>
      {multiline ? (
        <textarea
          required={required}
          rows={3}
          maxLength={1000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input
          required={required}
          type={type}
          maxLength={255}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </label>
  );
}