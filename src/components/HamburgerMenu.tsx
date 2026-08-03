import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Ban,
  BookMarked,
  ChevronLeft,
  Lock,
  LogOut,
  Menu,
  Moon,
  Music,
  Sparkles,
  Sun,
  UserCog,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotificationSettings } from "@/components/NotificationSettings";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

type Panel = "root" | "blocked" | "story" | "note" | "music";

export function HamburgerMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("root");
  const [userId, setUserId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [accountType, setAccountType] = useState<"personal" | "professional">("personal");
  const [isPrivate, setIsPrivate] = useState(false);
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type,is_private")
        .eq("id", data.user.id)
        .maybeSingle();
      setAccountType((profile as any)?.account_type === "professional" ? "professional" : "personal");
      setIsPrivate(Boolean((profile as any)?.is_private));
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
    } else {
      toast.success(next ? "Account set to private" : "Account is public");
    }
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
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="relative h-full w-[86%] max-w-sm overflow-y-auto border-r border-border bg-card p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              {panel === "root" ? (
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Sparkles size={16} className="text-primary" /> Settings
                </span>
              ) : (
                <button
                  onClick={() => setPanel("root")}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-accent transition"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            {panel === "root" && (
              <div className="space-y-3">
                <Card icon={<UserCog size={16} />} title="Account Type" sub="Changes what counts show on your profile.">
                  <div className="flex rounded-full border border-border overflow-hidden text-xs">
                    {(["personal", "professional"] as const).map((t) => (
                      <button
                        key={t}
                        disabled={busy}
                        onClick={() => changeAccountType(t)}
                        className={`px-3 py-1.5 transition ${accountType === t ? "text-primary-foreground" : "hover:bg-accent"}`}
                        style={accountType === t ? { background: "var(--gradient-glow)" } : undefined}
                      >
                        {t === "personal" ? "Personal" : "Pro"}
                      </button>
                    ))}
                  </div>
                </Card>

                <Card icon={<Lock size={16} />} title="Private Account" sub="Others must send a follow request.">
                  <Toggle checked={isPrivate} disabled={busy} onChange={togglePrivacy} />
                </Card>

                <Card
                  icon={theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                  title="Theme"
                  sub="Light or Lumen dark."
                >
                  <div className="flex rounded-full border border-border overflow-hidden text-xs">
                    {(["light", "dark"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => switchTheme(t)}
                        className={`px-3 py-1.5 capitalize transition ${theme === t ? "text-primary-foreground" : "hover:bg-accent"}`}
                        style={theme === t ? { background: "var(--gradient-glow)" } : undefined}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Card>

                {userId && <NotificationSettings userId={userId} />}

                <RowButton icon={<Ban size={16} />} label="Blocked Users" onClick={() => setPanel("blocked")} />
                <RowButton icon={<Sparkles size={16} />} label="Story Settings" onClick={() => setPanel("story")} />
                <RowButton icon={<BookMarked size={16} />} label="Note Settings" onClick={() => setPanel("note")} />
                <RowButton icon={<Music size={16} />} label="Music Takedown" onClick={() => setPanel("music")} />

                <button
                  onClick={handleLogout}
                  className="w-full rounded-2xl border border-border bg-card/70 p-4 flex items-center gap-3 text-left text-destructive hover:bg-accent transition"
                >
                  <span className="h-9 w-9 rounded-full grid place-items-center bg-background/70 border border-border">
                    <LogOut size={16} />
                  </span>
                  <span className="text-sm font-medium">Log out</span>
                </button>
              </div>
            )}

            {panel === "blocked" && <BlockedUsers meId={userId} />}
            {panel === "story" && (
              <Placeholder title="Story Settings" body="Stories are coming to Lumen soon. You'll be able to choose who can view and reply to your stories here." />
            )}
            {panel === "note" && (
              <Placeholder title="Note Settings" body="Notes let you share a short thought with friends. Visibility controls will live here." />
            )}
            {panel === "music" && (
              <Placeholder title="Music Takedown" body="If music in a post infringes your rights, this is where you'll file a takedown request. The form is not live yet." />
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function Card({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4 flex items-center gap-3 text-left">
      <div className="h-9 w-9 rounded-full grid place-items-center bg-background/70 border border-border shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      {children}
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

function RowButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-border bg-card/70 p-4 flex items-center gap-3 text-left hover:bg-accent transition"
    >
      <span className="h-9 w-9 rounded-full grid place-items-center bg-background/70 border border-border">
        {icon}
      </span>
      <span className="text-sm font-medium flex-1">{label}</span>
    </button>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <p className="text-sm font-medium">{title}</p>
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
      const { data } = await (supabase as any)
        .from("blocks")
        .select("id,blocked_id")
        .eq("blocker_id", meId);
      const list = (data ?? []) as { id: string; blocked_id: string }[];
      let names: Record<string, string | null> = {};
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
        <div key={r.id} className="rounded-2xl border border-border bg-card/70 p-3 flex items-center gap-3">
          <span className="text-sm flex-1 truncate">{r.name || "Lumen friend"}</span>
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
