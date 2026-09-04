import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { toast } from "sonner";
import { X } from "lucide-react";
import { moderate } from "@/lib/moderation";
import { NOTE_MAX_CHARS, notePrivacyLabel, type NotePrivacy } from "@/lib/notes";

type NoteRow = {
  id: string;
  user_id: string;
  content: string;
  privacy: NotePrivacy;
  expires_at: string;
};

type Person = { id: string; name: string | null; avatar_url: string | null };

/** Instagram-style 24h "Notes" strip shown above the conversation list. */
export function NotesBar() {
  const navigate = useNavigate();
  const [meId, setMeId] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [privacy, setPrivacy] = useState<NotePrivacy>("followers");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setMeId(auth.user.id);

    const [{ data: rows }, { data: profile }] = await Promise.all([
      (supabase as any)
        .from("notes")
        .select("id,user_id,content,privacy,expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("profiles")
        .select("default_note_privacy")
        .eq("id", auth.user.id)
        .maybeSingle(),
    ]);

    const list = ((rows ?? []) as NoteRow[]).slice();
    list.sort((a, b) => (a.user_id === auth.user!.id ? -1 : b.user_id === auth.user!.id ? 1 : 0));
    setNotes(list);
    if ((profile as any)?.default_note_privacy)
      setPrivacy((profile as any).default_note_privacy as NotePrivacy);

    const ids = Array.from(new Set([auth.user.id, ...list.map((n) => n.user_id)]));
    const { data: profs } = await supabase.from("profiles").select("id,name,avatar_url").in("id", ids);
    const map: Record<string, Person> = {};
    (profs ?? []).forEach((p: any) => (map[p.id] = p));
    setPeople(map);
    setAvatars(await getSignedUrls((profs ?? []).map((p: any) => p.avatar_url).filter(Boolean) as string[]));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myNote = meId ? notes.find((n) => n.user_id === meId) ?? null : null;
  const others = notes.filter((n) => n.user_id !== meId);

  function openComposer() {
    setDraft(myNote?.content ?? "");
    if (myNote) setPrivacy(myNote.privacy);
    setComposing(true);
  }

  async function saveNote() {
    if (!meId) return;
    const content = draft.trim();
    if (!content) return;
    const verdict = moderate(content);
    if (!verdict.ok) {
      toast.error(verdict.message ?? "That note can't be shared.");
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any).from("notes").upsert(
      {
        user_id: meId,
        content: content.slice(0, NOTE_MAX_CHARS),
        privacy,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComposing(false);
    toast.success("Note shared for 24 hours");
    load();
  }

  async function deleteNote() {
    if (!meId) return;
    setBusy(true);
    const { error } = await (supabase as any).from("notes").delete().eq("user_id", meId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComposing(false);
    load();
  }

  function Avatar({ id, size = 48 }: { id: string; size?: number }) {
    const p = people[id];
    const av = p?.avatar_url ? avatars[p.avatar_url] : undefined;
    return av ? (
      <img src={av} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
    ) : (
      <span
        className="rounded-full grid place-items-center text-primary-foreground font-medium"
        style={{ width: size, height: size, background: "var(--gradient-glow)" }}
      >
        {(p?.name || "L").trim().charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2 pt-1">
        <button onClick={openComposer} className="shrink-0 w-20 text-center" aria-label="Your note">
          <Bubble text={myNote?.content ?? "Leave a note…"} muted={!myNote} />
          {meId && <Avatar id={meId} />}
          <p className="mt-1 truncate text-[11px] text-muted-foreground">Your note</p>
        </button>

        {others.map((n) => (
          <button
            key={n.id}
            onClick={() => navigate({ to: "/messages/$id", params: { id: n.user_id } })}
            className="shrink-0 w-20 text-center"
          >
            <Bubble text={n.content} />
            <Avatar id={n.user_id} />
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {people[n.user_id]?.name || "Lumen friend"}
            </p>
          </button>
        ))}
      </div>

      {composing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">New note</h2>
              <button
                onClick={() => setComposing(false)}
                className="h-7 w-7 grid place-items-center rounded-full hover:bg-accent"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              value={draft}
              maxLength={NOTE_MAX_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Share a thought…"
              className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Disappears after 24 hours</span>
              <span>
                {draft.length}/{NOTE_MAX_CHARS}
              </span>
            </div>
            <div className="flex gap-2">
              {(["followers", "public"] as NotePrivacy[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrivacy(p)}
                  className={`flex-1 rounded-full border px-3 py-1.5 text-xs transition ${
                    privacy === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {notePrivacyLabel(p)}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              {myNote && (
                <button
                  onClick={deleteNote}
                  disabled={busy}
                  className="rounded-full border border-border px-4 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50"
                >
                  Delete
                </button>
              )}
              <button
                onClick={saveNote}
                disabled={busy || draft.trim().length === 0}
                className="flex-1 rounded-full px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--gradient-glow)" }}
              >
                Share note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <span
      className={`mx-auto mb-1 block max-w-[80px] rounded-2xl rounded-bl-sm border border-border bg-card px-2 py-1 text-[10px] leading-tight line-clamp-2 ${
        muted ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      {text}
    </span>
  );
}
