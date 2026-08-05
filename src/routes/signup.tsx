import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthShell } from "./login";
import { ageFrom } from "@/lib/legal";
import { recordConsents } from "@/lib/consent";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create account — Lumen" },
      { name: "description", content: "Join Lumen and share luminous moments." },
      { property: "og:title", content: "Create account — Lumen" },
      { property: "og:description", content: "Join Lumen and share luminous moments." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  const age = ageFrom(birthdate || null);
  const isMinor = age >= 0 && age < 18;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      toast.error("Please agree to the Terms and Privacy Policy");
      return;
    }
    if (age < 0) {
      toast.error("Please enter your date of birth");
      return;
    }
    if (age < 13) {
      toast.error("You must be at least 13 years old to use Lumen");
      return;
    }
    if (isMinor && !guardianEmail.trim()) {
      toast.error("A parent or guardian email is required for under-18 accounts");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { name },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const uid = data.user?.id;
    if (uid) {
      await (supabase as any)
        .from("profiles")
        .update({
          birthdate,
          is_minor: isMinor,
          guardian_email: isMinor ? guardianEmail.trim() : null,
        })
        .eq("id", uid);
      await recordConsents(uid, ["terms", "privacy", "data_privacy_act"]);
    }
    setLoading(false);
    toast.success("Welcome to Lumen ✨");
    navigate({ to: "/home", replace: true });
  }

  return (
    <AuthShell title="Create your Lumen" subtitle="A luminous space, just for you.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name" type="text" value={name} onChange={setName} autoComplete="name" />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Date of birth" type="date" value={birthdate} onChange={setBirthdate} autoComplete="bday" />
        {isMinor && (
          <div className="space-y-1.5">
            <Field
              label="Parent or guardian email"
              type="email"
              value={guardianEmail}
              onChange={setGuardianEmail}
            />
            <p className="text-xs text-muted-foreground">
              We'll send them a link to confirm. Until they do, strangers can't message you and your
              posts stay limited to people you follow.
            </p>
          </div>
        )}
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            I agree to Lumen{" "}
            <Link to="/terms" className="text-foreground underline underline-offset-4">Terms</Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-foreground underline underline-offset-4">Privacy Policy</Link>
          </span>
        </label>
        <button
          type="submit"
          disabled={loading || !agreed}
          className="w-full rounded-xl py-3 text-primary-foreground font-medium transition disabled:opacity-60"
          style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-muted-foreground text-center mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-foreground font-medium underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground mb-1.5 block">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring transition"
      />
    </label>
  );
}