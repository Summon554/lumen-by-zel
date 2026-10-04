import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { LumenAvatar } from "@/components/LumenAvatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Person = { id: string; name: string | null; username: string | null; avatar_url: string | null; is_private: boolean };
export function WhoEncouraged({ postId, meId, onClose }: { postId: string; meId: string | null; onClose: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: likes, error } = await supabase.from("likes").select("user_id").eq("post_id", postId);
      if (error) { toast.error(error.message); return; }
      const ids = [...new Set((likes ?? []).map((l) => l.user_id))];
      if (!ids.length) return;
      const [{ data: profiles }, { data: follows }, { data: requests }] = await Promise.all([
        supabase.from("profiles").select("id,name,username,avatar_url,is_private").in("id", ids),
        (supabase as any).from("follows").select("following_id").eq("follower_id", meId ?? ""),
        (supabase as any).from("follow_requests").select("target_id").eq("requester_id", meId ?? "").eq("status", "pending"),
      ]);
      if (cancelled) return;
      const list = (profiles ?? []) as Person[];
      setPeople(list);
      setUrls(await getSignedUrls(list.map((p) => p.avatar_url).filter(Boolean) as string[]));
      setFollowing(new Set((follows ?? []).map((f: { following_id: string }) => f.following_id)));
      setRequested(new Set((requests ?? []).map((r: { target_id: string }) => r.target_id)));
    })();
    return () => { cancelled = true; };
  }, [postId, meId]);
  async function toggle(person: Person) {
    if (!meId || busy) return;
    setBusy(person.id);
    const sb = supabase as any;
    try {
      if (following.has(person.id)) {
        const { error } = await sb.from("follows").delete().eq("follower_id", meId).eq("following_id", person.id); if (error) throw error;
        setFollowing((old) => { const next = new Set(old); next.delete(person.id); return next; });
      } else if (requested.has(person.id)) {
        const { error } = await sb.from("follow_requests").delete().eq("requester_id", meId).eq("target_id", person.id); if (error) throw error;
        setRequested((old) => { const next = new Set(old); next.delete(person.id); return next; });
      } else if (person.is_private) {
        const { error } = await sb.from("follow_requests").insert({ requester_id: meId, target_id: person.id, status: "pending" }); if (error) throw error;
        setRequested((old) => new Set(old).add(person.id));
      } else {
        const { error } = await sb.from("follows").insert({ follower_id: meId, following_id: person.id }); if (error) throw error;
        setFollowing((old) => new Set(old).add(person.id));
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update follow"); }
    finally { setBusy(null); }
  }
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/60" role="dialog" aria-modal="true" aria-label="Who encouraged"><div className="max-h-[75dvh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-background p-4 text-foreground">
    <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Who encouraged</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={18}/></Button></div>
    {!people.length && <p className="py-8 text-center text-sm text-muted-foreground">No encouragements yet.</p>}
    {people.map((p) => <div key={p.id} className="flex items-center gap-3 border-t border-border py-3"><Link to="/u/$id" params={{ id: p.id }} onClick={onClose}><LumenAvatar name={p.name} url={p.avatar_url ? urls[p.avatar_url] : null} size={42}/></Link><Link to="/u/$id" params={{ id: p.id }} onClick={onClose} className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name || "Lumen friend"}</p><p className="truncate text-xs text-muted-foreground">@{p.username || "lumen"}</p></Link>{p.id !== meId && <Button size="sm" variant={following.has(p.id) || requested.has(p.id) ? "outline" : "default"} disabled={busy === p.id} onClick={() => toggle(p)}>{following.has(p.id) ? "Following" : requested.has(p.id) ? "Requested" : "Follow"}</Button>}</div>)}
  </div></div>;
}
