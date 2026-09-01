import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Download, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  submitAppeal,
} from "@/lib/account.functions";
import { requestGuardianVerification } from "@/lib/guardian.functions";
import { ageFrom } from "@/lib/legal";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your data & account — Lumen" },
      { name: "description", content: "Download your Lumen data, manage guardian consent, or delete your account." },
      { property: "og:title", content: "Your data & account — Lumen" },
      { property: "og:description", content: "Download your Lumen data, manage guardian consent, or delete your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  birthdate: string | null;
  is_minor: boolean | null;
  guardian_email: string | null;
  guardian_verified: boolean | null;
  strikes: number | null;
  suspended_until: string | null;
  deletion_requested_at: string | null;
};

function AccountPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianLink, setGuardianLink] = useState<string | null>(null);
  const [appeal, setAppeal] = useState("");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data } = await (supabase as any)
        .from("profiles")
        .select(
          "id,name,email,birthdate,is_minor,guardian_email,guardian_verified,strikes,suspended_until,deletion_requested_at",
        )
        .eq("id", auth.user.id)
        .maybeSingle();
      setProfile(data as Profile);
      setGuardianEmail((data as Profile)?.guardian_email ?? "");
      setLoading(false);
    })();
  }, [navigate]);

  async function exportData() {
    if (!profile) return;
    setBusy(true);
    const uid = profile.id;
    const [posts, comments, likes, reactions, follows, messages, consents] = await Promise.all([
      (supabase as any).from("posts").select("*").eq("user_id", uid),
      (supabase as any).from("comments").select("*").eq("user_id", uid),
      (supabase as any).from("likes").select("*").eq("user_id", uid),
      (supabase as any).from("reactions").select("*").eq("user_id", uid),
      (supabase as any).from("follows").select("*").eq("follower_id", uid),
      (supabase as any).from("messages").select("*").eq("sender_id", uid),
      (supabase as any).from("user_consents").select("*").eq("user_id", uid),
    ]);
    const payload = {
      exported_at: new Date().toISOString(),
      profile,
      posts: posts.data ?? [],
      comments: comments.data ?? [],
      likes: likes.data ?? [],
      reactions: reactions.data ?? [],
      following: follows.data ?? [],
      messages_sent: messages.data ?? [],
      consents: consents.data ?? [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-data-${uid.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
    toast.success("Your data is downloading.");
  }

  async function scheduleDeletion() {
    if (!confirm("Delete your Lumen account? You'll have 7 days to undo this before it's permanent.")) return;
    setBusy(true);
    try {
      const { purgeAt } = await requestAccountDeletion({ data: undefined as never });
      setProfile((p) => (p ? { ...p, deletion_requested_at: new Date().toISOString() } : p));
      toast.success(`Scheduled. Permanent on ${new Date(purgeAt).toLocaleDateString()}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  async function undoDeletion() {
    setBusy(true);
    try {
      await cancelAccountDeletion({ data: undefined as never });
      setProfile((p) => (p ? { ...p, deletion_requested_at: null } : p));
      toast.success("Welcome back — your account is safe.");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  async function sendGuardian(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await requestGuardianVerification({ data: { guardianEmail } });
      setGuardianLink(res.guardianEmail);
      toast.success("Verification request sent to your parent or guardian.");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  async function sendAppeal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitAppeal({ data: { message: appeal } });
      setAppeal("");
      toast.success("Your appeal was submitted — a moderator will review it.");
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  const derivedAge = profile ? ageFrom(profile.birthdate) : -1;
  const minor = profile
    ? (profile.is_minor ?? (derivedAge >= 0 && derivedAge < 18))
    : false;
  const purgeDate = profile?.deletion_requested_at
    ? new Date(new Date(profile.deletion_requested_at).getTime() + 7 * 86400000)
    : null;

  return (
    <main className="min-h-screen px-5 py-8" style={{ background: "var(--gradient-bg)" }}>
      <div className="max-w-xl mx-auto space-y-4">
        <Link to="/home" className="inline-flex items-center gap-2 mb-2">
          <div
            className="h-9 w-9 rounded-full grid place-items-center text-primary-foreground"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            <Sparkles size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Your data & account</span>
        </Link>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {purgeDate && (
              <Card>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Deletion scheduled</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your account and everything in it will be permanently erased on{" "}
                      {purgeDate.toLocaleDateString()}. You can undo until then.
                    </p>
                    <button
                      disabled={busy}
                      onClick={undoDeletion}
                      className="mt-3 rounded-full px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
                      style={{ background: "var(--gradient-glow)" }}
                    >
                      Undo deletion
                    </button>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <Header icon={<Download size={16} />} title="Download my data" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Get a JSON copy of your profile, posts, comments, reactions, follows and sent messages —
                your right to data portability under the Data Privacy Act.
              </p>
              <button
                disabled={busy}
                onClick={exportData}
                className="mt-3 rounded-full border border-border px-4 py-2 text-xs font-medium hover:bg-accent transition disabled:opacity-60"
              >
                Download JSON
              </button>
            </Card>

            {minor && (
              <Card>
                <Header icon={<ShieldCheck size={16} />} title="Parent or guardian consent" />
                {profile?.guardian_verified ? (
                  <p className="text-xs text-muted-foreground">
                    Confirmed by {profile.guardian_email}. Your account has full access.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Because you're under 18, a parent or guardian must confirm your account. Until then
                      strangers can't message you and your posts stay limited to people you follow.
                    </p>
                    <form onSubmit={sendGuardian} className="mt-3 flex gap-2">
                      <input
                        required
                        type="email"
                        value={guardianEmail}
                        onChange={(e) => setGuardianEmail(e.target.value)}
                        placeholder="guardian@email.com"
                        className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      />
                      <button
                        disabled={busy}
                        className="rounded-full px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
                        style={{ background: "var(--gradient-glow)" }}
                      >
                        Send link
                      </button>
                    </form>
                    {guardianLink && (
                      <p className="mt-2 break-all text-[11px] text-muted-foreground">
                        A confirmation link is on its way to{" "}
                        <span className="text-foreground">{guardianLink}</span>. Only your parent or
                        guardian can open it — ask them to check their inbox.
                      </p>
                    )}
                  </>
                )}
              </Card>
            )}

            {(profile?.strikes ?? 0) > 0 && (
              <Card>
                <Header icon={<AlertTriangle size={16} />} title={`Strikes: ${profile?.strikes} of 3`} />
                {profile?.suspended_until && new Date(profile.suspended_until) > new Date() && (
                  <p className="text-xs text-destructive">
                    Suspended until {new Date(profile.suspended_until).toLocaleString()}.
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Think we got it wrong? Tell us what happened — a real person will read this.
                </p>
                <form onSubmit={sendAppeal} className="mt-3 space-y-2">
                  <textarea
                    required
                    minLength={20}
                    maxLength={2000}
                    rows={4}
                    value={appeal}
                    onChange={(e) => setAppeal(e.target.value)}
                    placeholder="Explain your side (at least 20 characters)…"
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    disabled={busy}
                    className="rounded-full px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
                    style={{ background: "var(--gradient-glow)" }}
                  >
                    Submit appeal
                  </button>
                </form>
              </Card>
            )}

            {!purgeDate && (
              <Card>
                <Header icon={<Trash2 size={16} />} title="Delete my account" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Removes your profile, posts, comments, reactions and messages. You get 7 days to change
                  your mind before it becomes permanent.
                </p>
                <button
                  disabled={busy}
                  onClick={scheduleDeletion}
                  className="mt-3 rounded-full border border-destructive/40 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition disabled:opacity-60"
                >
                  Delete account
                </button>
              </Card>
            )}

            <p className="text-center text-xs text-muted-foreground">
              <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link> ·{" "}
              <Link to="/terms" className="underline underline-offset-4">Terms</Link> ·{" "}
              <Link to="/takedown" className="underline underline-offset-4">Music takedown</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4">{children}</section>;
}

function Header({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold mb-1.5">
      <span className="text-primary">{icon}</span>
      {title}
    </h2>
  );
}