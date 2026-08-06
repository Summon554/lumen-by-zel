import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, logAdminAction } from "@/lib/admin";
import { toast } from "sonner";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Lumen" },
      { name: "description", content: "Moderation dashboard for reports, strikes and takedowns on Lumen." },
      { property: "og:title", content: "Admin — Lumen" },
      { property: "og:description", content: "Moderation dashboard for reports, strikes and takedowns on Lumen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Row = Record<string, any>;

function AdminPage() {
  const { loading, isAdmin, email, userId } = useIsAdmin();
  const [stats, setStats] = useState({ users: 0, active: 0, stories: 0, notes: 0, openReports: 0, resolvedReports: 0, takedowns: 0 });
  const [reports, setReports] = useState<Row[]>([]);
  const [appeals, setAppeals] = useState<Row[]>([]);
  const [takedowns, setTakedowns] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [audit, setAudit] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase as any;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [profiles, activeCount, storyCount, reportRows, takedownRows, appealRows, auditRows] = await Promise.all([
      sb.from("profiles").select("id,name,email,strikes,suspended_until,is_founder,created_at").order("created_at", { ascending: false }).limit(50),
      sb.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", since),
      sb.from("stories").select("id,kind", { count: "exact" }).eq("archived", false).gt("expires_at", new Date().toISOString()),
      sb.from("reports").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("takedown_requests").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("appeals").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("admin_actions").select("*").order("created_at", { ascending: false }).limit(30),
    ]);

    const allReports = (reportRows.data ?? []) as Row[];
    setReports(allReports);
    setTakedowns((takedownRows.data ?? []) as Row[]);
    setAppeals((appealRows.data ?? []) as Row[]);
    setUsers((profiles.data ?? []) as Row[]);
    setAudit((auditRows.data ?? []) as Row[]);
    setStats({
      users: (profiles.data ?? []).length,
      active: activeCount.count ?? 0,
      stories: (storyCount.data ?? []).length,
      notes: ((storyCount.data ?? []) as Row[]).filter((s) => s.kind === "text").length,
      openReports: allReports.filter((r) => r.status !== "resolved" && r.status !== "dismissed").length,
      resolvedReports: allReports.filter((r) => r.status === "resolved" || r.status === "dismissed").length,
      takedowns: (takedownRows.data ?? []).length,
    });
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  async function act(fn: () => Promise<any>, action: string, targetId: string | null, notes: string, okMsg: string) {
    if (!userId || !email) return;
    setBusy(true);
    const { error } = (await fn()) ?? {};
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    await logAdminAction(userId, email, action, targetId, notes);
    await load();
    setBusy(false);
    toast.success(okMsg);
  }

  if (loading) return <Shell><p className="text-sm text-muted-foreground">Checking access…</p></Shell>;

  if (!isAdmin)
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto text-destructive" size={28} />
          <p className="mt-3 text-sm font-medium text-foreground">Admin access only</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This dashboard is restricted at the database level. Your account isn't an admin.
          </p>
          <Link to="/home" className="mt-4 inline-block rounded-full border border-border px-4 py-2 text-xs">
            Back to Lumen
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Users" value={stats.users} />
        <Stat label="Active (7d)" value={stats.active} />
        <Stat label="Active stories" value={stats.stories} />
        <Stat label="Active notes" value={stats.notes} />
        <Stat label="Open reports" value={stats.openReports} />
        <Stat label="Resolved reports" value={stats.resolvedReports} />
        <Stat label="Takedowns" value={stats.takedowns} />
        <Stat label="Appeals" value={appeals.length} />
      </div>

      <Section title="Reports">
        {reports.length === 0 && <Empty>No reports.</Empty>}
        {reports.map((r) => (
          <Card key={r.id}>
            <p className="text-sm font-medium text-foreground">{r.reason}</p>
            <p className="text-xs text-muted-foreground">
              {r.content_type ?? "user"} · status {r.status} · {new Date(r.created_at).toLocaleString()}
            </p>
            {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
            <Actions>
              <Btn
                disabled={busy}
                onClick={() =>
                  act(
                    () => (supabase as any).from("reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", r.id),
                    "report_resolved",
                    r.id,
                    r.reason,
                    "Report resolved",
                  )
                }
              >
                Resolve
              </Btn>
              <Btn
                disabled={busy}
                onClick={() =>
                  act(
                    () => (supabase as any).from("reports").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("id", r.id),
                    "report_dismissed",
                    r.id,
                    r.reason,
                    "Report dismissed",
                  )
                }
              >
                Dismiss
              </Btn>
              {r.post_id && (
                <Btn
                  danger
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => (supabase as any).from("posts").delete().eq("id", r.post_id),
                      "post_deleted",
                      r.post_id,
                      `via report ${r.id}`,
                      "Post deleted",
                    )
                  }
                >
                  Delete post
                </Btn>
              )}
              {r.reported_user_id && (
                <Btn
                  danger
                  disabled={busy}
                  onClick={() =>
                    act(
                      async () => {
                        const sb = supabase as any;
                        await sb.from("strikes").insert({ user_id: r.reported_user_id, reason: r.reason, notes: `report ${r.id}` });
                        return sb
                          .from("profiles")
                          .update({ suspended_until: new Date(Date.now() + 30 * 86400000).toISOString() })
                          .eq("id", r.reported_user_id);
                      },
                      "user_banned",
                      r.reported_user_id,
                      `strike + 30d ban via report ${r.id}`,
                      "User banned for 30 days",
                    )
                  }
                >
                  Strike &amp; ban
                </Btn>
              )}
            </Actions>
          </Card>
        ))}
      </Section>

      <Section title="Music takedown requests">
        {takedowns.length === 0 && <Empty>No takedown requests.</Empty>}
        {takedowns.map((t) => (
          <Card key={t.id}>
            <p className="text-sm font-medium text-foreground">{t.work_title}</p>
            <p className="text-xs text-muted-foreground">
              {t.requester_name} · {t.requester_email} · status {t.status}
            </p>
            {t.content_url && <p className="mt-1 break-all text-xs text-muted-foreground">{t.content_url}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{t.rights_statement}</p>
            <Actions>
              <Btn
                disabled={busy}
                onClick={() =>
                  act(
                    () => (supabase as any).from("takedown_requests").update({ status: "approved" }).eq("id", t.id),
                    "takedown_approved",
                    t.id,
                    t.work_title,
                    "Takedown approved",
                  )
                }
              >
                Approve
              </Btn>
              <Btn
                disabled={busy}
                onClick={() =>
                  act(
                    () => (supabase as any).from("takedown_requests").update({ status: "denied" }).eq("id", t.id),
                    "takedown_denied",
                    t.id,
                    t.work_title,
                    "Takedown denied",
                  )
                }
              >
                Deny
              </Btn>
            </Actions>
          </Card>
        ))}
      </Section>

      <Section title="Appeals">
        {appeals.length === 0 && <Empty>No appeals.</Empty>}
        {appeals.map((a) => (
          <Card key={a.id}>
            <p className="text-sm text-foreground">{a.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              status {a.status} · {new Date(a.created_at).toLocaleString()}
            </p>
            <Actions>
              <Btn
                disabled={busy}
                onClick={() =>
                  act(
                    async () => {
                      const sb = supabase as any;
                      await sb.from("profiles").update({ suspended_until: null }).eq("id", a.user_id);
                      return sb.from("appeals").update({ status: "granted", resolved_at: new Date().toISOString() }).eq("id", a.id);
                    },
                    "appeal_granted",
                    a.id,
                    "suspension lifted",
                    "Appeal granted",
                  )
                }
              >
                Grant &amp; unban
              </Btn>
              <Btn
                disabled={busy}
                onClick={() =>
                  act(
                    () => (supabase as any).from("appeals").update({ status: "denied", resolved_at: new Date().toISOString() }).eq("id", a.id),
                    "appeal_denied",
                    a.id,
                    "",
                    "Appeal denied",
                  )
                }
              >
                Deny
              </Btn>
            </Actions>
          </Card>
        ))}
      </Section>

      <Section title="Users">
        {users.map((u) => {
          const banned = u.suspended_until && new Date(u.suspended_until) > new Date();
          return (
            <Card key={u.id}>
              <p className="text-sm font-medium text-foreground">{u.name || "Lumen friend"}</p>
              <p className="text-xs text-muted-foreground">
                {u.email} · {u.strikes ?? 0} strike(s){banned ? " · suspended" : ""}
              </p>
              <Actions>
                {banned ? (
                  <Btn
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => (supabase as any).from("profiles").update({ suspended_until: null }).eq("id", u.id),
                        "user_unbanned",
                        u.id,
                        u.email ?? "",
                        "User unbanned",
                      )
                    }
                  >
                    Unban
                  </Btn>
                ) : (
                  <Btn
                    danger
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          (supabase as any)
                            .from("profiles")
                            .update({ suspended_until: new Date(Date.now() + 30 * 86400000).toISOString() })
                            .eq("id", u.id),
                        "user_banned",
                        u.id,
                        u.email ?? "",
                        "User banned for 30 days",
                      )
                    }
                  >
                    Ban 30d
                  </Btn>
                )}
              </Actions>
            </Card>
          );
        })}
      </Section>

      <Section title="Audit log">
        {audit.length === 0 && <Empty>No admin actions yet.</Empty>}
        {audit.map((a) => (
          <div key={a.id} className="border-b border-border/60 py-2 text-xs text-muted-foreground">
            <span className="text-foreground">{a.action_type}</span> · {a.admin_email} ·{" "}
            {new Date(a.created_at).toLocaleString()}
            {a.notes ? ` · ${a.notes}` : ""}
          </div>
        ))}
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen pb-16" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link to="/home" className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-base font-semibold">Admin dashboard</h1>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-5">{children}</div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-3">{children}</div>;
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 flex flex-wrap gap-2">{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Btn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border border-border px-3 py-1 text-xs transition hover:bg-accent disabled:opacity-50 ${
        danger ? "text-destructive" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}