import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Lumen" },
      { name: "description", content: "Sign in to your Lumen account." },
      { property: "og:title", content: "Sign in — Lumen" },
      { property: "og:description", content: "Sign in to your Lumen account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/home", replace: true });
  }

  return <AuthShell title="Welcome back" subtitle="Sign in to keep the glow going.">
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-3 text-primary-foreground font-medium transition disabled:opacity-60"
        style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
    <p className="text-sm text-muted-foreground text-center mt-6">
      New to Lumen?{" "}
      <Link to="/signup" className="text-foreground font-medium underline underline-offset-4">
        Create account
      </Link>
    </p>
  </AuthShell>;
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

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className="min-h-screen px-5 py-10 flex flex-col items-center"
      style={{ background: "var(--gradient-bg)" }}
    >
      <div className="flex items-center gap-2 mb-10">
        <div
          className="h-10 w-10 rounded-full grid place-items-center text-primary-foreground"
          style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
        >
          <Sparkles size={20} />
        </div>
        <span className="text-xl font-semibold tracking-tight">Lumen</span>
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/70 backdrop-blur p-6 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}