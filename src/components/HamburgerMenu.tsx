import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  BookMarked,
  Bell,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Heart,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Music,
  Shield,
  Sparkles,
  Sun,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { useIsAdmin } from "@/lib/admin";

type Panel = "root" | "blocked" | "story" | "note";
type Prefs = { messages: boolean; reactions: boolean; follows: boolean };

export function HamburgerMenu() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("root");
  const [userId, setUserId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [accountType, setAccountType] = useState<"personal" | "professional">("personal");
  const [isPrivate, setIsPrivate] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ messages: true, reactions: true, follows: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!open || userId) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const [{ data: profile }, { data: pref }] = await Promise.all([
        supabase.from("profiles").select("account_type,is_private").eq("id", data.user.id).maybeSingle(),
        (supabase as any)
          .from("notification_prefs")
          .select("messages,reactions,follows")
          .eq("user_id", data.user.id)
          .maybeSingle(),
      ]);
      setAccountType((profile as any)?.account_type === "professional" ? "professional" : "personal");
      setIsPrivate(Boolean((profile as any)?.is_private));
      if (pref) setPrefs(pref as Prefs);
    })();
  }, [open, userId]);

  function switchTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  async function changeAccountType(next: "personal" | "professional") {
    if (!userId || next === accountType) return;
    const prev = accountType;
    setAccountType(next);
    setBusy(true);
    const { error } = await (supabase as any).from("profiles").update({ account_type: next }).eq("id", userId);
    setBusy(false);
    if (error) {
      setAccountType(prev);
      toast.error(error.message);
    }
  }

  async function togglePrivacy(next: boolean) {
    if (!userId) return;
    const prev = isPrivate;
    setIsPrivate(next);
    setBusy(true);
    const { error } = await (supabase as any).from("profiles").update({ is_private: next }).eq("id", userId);
    setBusy(false);
    if (error) {
      setIsPrivate(prev);
      toast.error(error.message);
    }
  }

  async function updatePref(key: keyof Prefs, value: boolean) {
    if (!userId) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await (supabase as any)
      .from("notification_prefs")
      .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    if (error) toast.error(error.message);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <>
      <button
        onClick={() => {
          setPanel("root");
          setOpen(true);
        }}
        className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent transition"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="relative h-auto min-h-full w-[88%] max-w-sm border-r border-border bg-card text-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles size={15} className="text-primary" /> Settings
              </span>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-accent transition"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            <div className="pb-6">
                <SectionHeader>Account</SectionHeader>
                <Row icon={<UserCog size={16} />} label="Account Type">
                  <Segmented
                    value={accountType}
                    disabled={busy}
                    options={[
                      ["personal", "Personal"],
                      ["professional", "Pro"],
                    ]}
                    onChange={(v) => changeAccountType(v as "personal" | "professional")}
                  />
                </Row>

                <SectionHeader>Privacy</SectionHeader>
                <Row icon={<Lock size={16} />} label="Private Account">
                  <Toggle checked={isPrivate} disabled={busy} onChange={togglePrivacy} />
                </Row>
                <Row icon={<Ban size={16} />} label="Blocked Users" />
                <div className="px-4 pb-3">
                  <BlockedUsers meId={userId} />
                </div>

                <SectionHeader>Notifications</SectionHeader>
                <Row icon={<MessageSquare size={16} />} label="New messages">
                  <Toggle checked={prefs.messages} onChange={(v) => updatePref("messages", v)} />
                </Row>
                <Row icon={<Heart size={16} />} label="Reactions">
                  <Toggle checked={prefs.reactions} onChange={(v) => updatePref("reactions", v)} />
                </Row>
                <Row icon={<UserPlus size={16} />} label="New followers">
                  <Toggle checked={prefs.follows} onChange={(v) => updatePref("follows", v)} />
                </Row>
                <p className="px-4 pb-1 text-[11px] text-muted-foreground">Quiet hours 10PM–6AM always respected.</p>

                <SectionHeader>Appearance</SectionHeader>
                <Row icon={theme === "dark" ? <Moon size={16} /> : <Sun size={16} />} label="Theme">
                  <Segmented
                    value={theme}
                    options={[
                      ["light", "Light"],
                      ["dark", "Dark"],
                    ]}
                    onChange={(v) => switchTheme(v as Theme)}
                  />
                </Row>

                <SectionHeader>Content</SectionHeader>
                <Link
                  to="/stories/archive"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 min-h-[48px] border-b border-border/60 hover:bg-accent transition"
                >
                  <span className="text-muted-foreground">
                    <Sparkles size={16} />
                  </span>
                  <span className="flex-1 text-sm text-foreground">Archived Stories</span>
                </Link>
                <Row icon={<Sparkles size={16} />} label="Story Settings" />
                <p className="px-4 pb-2 text-[11px] text-muted-foreground">
                  Choose your default story audience while sharing a Light Moment.
                </p>
                <Row icon={<BookMarked size={16} />} label="Note Settings" />
                <p className="px-4 pb-2 text-[11px] text-muted-foreground">
                  Notes are short 60-character thoughts. Visibility controls arrive with Notes.
                </p>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 min-h-[48px] border-b border-border/60 hover:bg-accent transition"
                  >
                    <span className="text-muted-foreground">
                      <Shield size={16} />
                    </span>
                    <span className="flex-1 text-sm text-foreground">Admin dashboard</span>
                  </Link>
                )}
                <Link
                  to="/takedown"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 min-h-[48px] border-b border-border/60 hover:bg-accent transition"
                >
                  <span className="text-muted-foreground">
                    <Music size={16} />
                  </span>
                  <span className="flex-1 text-sm text-foreground">Music Takedown</span>
                </Link>
                <Link
                  to="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 min-h-[48px] border-b border-border/60 hover:bg-accent transition"
                >
                  <span className="text-muted-foreground">
                    <Download size={16} />
                  </span>
                  <span className="flex-1 text-sm text-foreground">Your data &amp; account</span>
                </Link>
                <Link
                  to="/privacy"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 min-h-[48px] border-b border-border/60 hover:bg-accent transition"
                >
                  <span className="text-muted-foreground">
                    <Shield size={16} />
                  </span>
                  <span className="flex-1 text-sm text-foreground">Privacy Policy</span>
                </Link>
                <Link
                  to="/terms"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 min-h-[48px] border-b border-border/60 hover:bg-accent transition"
                >
                  <span className="text-muted-foreground">
                    <FileText size={16} />
                  </span>
                  <span className="flex-1 text-sm text-foreground">Terms of Service</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="mt-3 mx-4 w-[calc(100%-2rem)] rounded-full border border-border px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-destructive hover:bg-accent transition"
                >
                  <LogOut size={15} /> Log out
                </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Row({
  icon,
  label,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="flex-1 text-sm text-foreground truncate">{label}</span>
      {children}
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 min-h-[48px] border-b border-border/60 text-left hover:bg-accent transition"
      >
        {inner}
      </button>
    );
  }
  return <div className="flex items-center gap-3 px-4 min-h-[48px] border-b border-border/60">{inner}</div>;
}

function Segmented({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: [string, string][];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-full border border-border overflow-hidden text-xs shrink-0">
      {options.map(([v, label]) => (
        <button
          key={v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`px-3 py-1 transition ${value === v ? "text-primary-foreground" : "text-foreground hover:bg-accent"}`}
          style={value === v ? { background: "var(--gradient-glow)" } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="w-11 h-6 rounded-full bg-muted peer-checked:[background:var(--gradient-glow)] transition" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{body}</p>
      <p className="mt-3 inline-block rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Coming soon
      </p>
    </div>
  );
}

function BlockedUsers({ meId }: { meId: string | null }) {
  const [rows, setRows] = useState<{ id: string; blocked_id: string; name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meId) return;
    (async () => {
      const { data } = await (supabase as any).from("blocks").select("id,blocked_id").eq("blocker_id", meId);
      const list = (data ?? []) as { id: string; blocked_id: string }[];
      const names: Record<string, string | null> = {};
      if (list.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,name")
          .in("id", list.map((b) => b.blocked_id));
        (profs ?? []).forEach((p) => (names[p.id] = p.name));
      }
      setRows(list.map((b) => ({ ...b, name: names[b.blocked_id] ?? null })));
      setLoading(false);
    })();
  }, [meId]);

  async function unblock(id: string) {
    const { error } = await (supabase as any).from("blocks").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Unblocked");
  }

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground py-6 text-center">You haven't blocked anyone.</p>;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
          <span className="text-sm flex-1 truncate text-foreground">{r.name || "Lumen friend"}</span>
          <button
            onClick={() => unblock(r.id)}
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent transition"
          >
            Unblock
          </button>
        </div>
      ))}
    </div>
  );
}
