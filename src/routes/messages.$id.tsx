import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getSignedUrl,
  getSignedUrls,
  uploadUserFile,
  compressImage,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_BYTES,
} from "@/lib/storage";
import { toast } from "sonner";
import { ArrowLeft, Send, Paperclip, Check, CheckCheck, Trash2, FileText } from "lucide-react";
import { UserActionMenu } from "@/components/UserActionMenu";
import { PresenceDot } from "@/components/PresenceDot";
import { isOnline, lastSeenLabel } from "@/lib/presence";
import { MediaViewer, type ViewerMedia } from "@/components/MediaViewer";
import { LumenVideo } from "@/components/LumenVideo";
import { BubbleSkeleton } from "@/components/Skeleton";

export const Route = createFileRoute("/messages/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat — Lumen" },
      { name: "description", content: "Send a direct message on Lumen." },
      { property: "og:title", content: "Chat — Lumen" },
      { property: "og:description", content: "Send a direct message on Lumen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Msg = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  read_at?: string | null;
  deleted_for_everyone?: boolean | null;
};

const MSG_COLUMNS =
  "id,sender_id,receiver_id,content,created_at,attachment_url,attachment_type,attachment_name,read_at,deleted_for_everyone";

function ChatPage() {
  const { id: otherId } = Route.useParams();
  const navigate = useNavigate();
  const endRef = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<string | null>(null);
  const [other, setOther] = useState<{ name: string | null; avatar: string | null; lastSeen: string | null } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [otherTyping, setOtherTyping] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [viewer, setViewer] = useState<ViewerMedia | null>(null);

  async function load(meId: string) {
    const { data } = await supabase
      .from("messages")
      .select(MSG_COLUMNS)
      .or(
        `and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`,
      )
      .order("created_at", { ascending: true })
      .limit(200);
    const list = (data ?? []) as unknown as Msg[];
    setMsgs(list);
    const paths = list.map((m) => m.attachment_url).filter(Boolean) as string[];
    if (paths.length) setFileUrls(await getSignedUrls(paths));

    const { data: dels } = await (supabase as any)
      .from("message_deletes")
      .select("message_id")
      .eq("user_id", meId);
    setHiddenIds(new Set((dels ?? []).map((d: any) => d.message_id)));

    // mark incoming messages as read
    const unread = list.filter((m) => m.receiver_id === meId && !m.read_at).map((m) => m.id);
    if (unread.length) {
      await (supabase as any)
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unread);
    }
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setMe(auth.user.id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("name,avatar_url,last_seen_at")
        .eq("id", otherId)
        .maybeSingle();
      setOther({
        name: prof?.name ?? null,
        avatar: prof?.avatar_url ? await getSignedUrl(prof.avatar_url) : null,
        lastSeen: (prof as any)?.last_seen_at ?? null,
      });
      const { data: blockRow } = await (supabase as any)
        .from("blocks")
        .select("id")
        .eq("blocker_id", auth.user.id)
        .eq("blocked_id", otherId)
        .maybeSingle();
      setBlocked(!!blockRow);
      await load(auth.user.id);
      setLoading(false);

      const threadKey = [auth.user.id, otherId].sort().join("-");
      typingChannel.current = supabase
        .channel(`typing-${threadKey}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "typing" }, (payload) => {
          if ((payload.payload as any)?.from !== otherId) return;
          setOtherTyping(true);
          setTimeout(() => setOtherTyping(false), 2500);
        })
        .subscribe();

      channel = supabase
        .channel(`dm-${auth.user.id}-${otherId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const m = payload.new as Msg;
            const mine = auth.user!.id;
            const inThread =
              (m.sender_id === mine && m.receiver_id === otherId) ||
              (m.sender_id === otherId && m.receiver_id === mine);
            if (!inThread) return;
            setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            if (m.attachment_url) {
              const url = await getSignedUrl(m.attachment_url);
              if (url) setFileUrls((prev) => ({ ...prev, [m.attachment_url as string]: url }));
            }
            if (m.receiver_id === mine) {
              await (supabase as any)
                .from("messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", m.id);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            const m = payload.new as Msg;
            setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
      if (typingChannel.current) supabase.removeChannel(typingChannel.current);
    };
  }, [otherId, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, otherTyping]);

  function notifyTyping() {
    if (!me) return;
    if (typingTimer.current) return;
    typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { from: me } });
    typingTimer.current = setTimeout(() => {
      typingTimer.current = null;
    }, 1500);
  }

  async function deleteForMe(m: Msg) {
    if (!me) return;
    await (supabase as any).from("message_deletes").insert({ message_id: m.id, user_id: me });
    setHiddenIds((prev) => new Set(prev).add(m.id));
    setMenuFor(null);
  }

  async function deleteForEveryone(m: Msg) {
    if (!me || m.sender_id !== me) return;
    const { error } = await (supabase as any)
      .from("messages")
      .update({ deleted_for_everyone: true, content: "", attachment_url: null })
      .eq("id", m.id);
    if (error) toast.error(error.message);
    else setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_for_everyone: true, content: "" } : x)));
    setMenuFor(null);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!me || (!content && !pendingFile)) return;
    setSending(true);
    try {
      let attachment_url: string | null = null;
      let attachment_type: string | null = null;
      let attachment_name: string | null = null;
      if (pendingFile) {
        const isImage = pendingFile.type.startsWith("image/");
        const isVideo = pendingFile.type.startsWith("video/");
        const isPdf = pendingFile.type === "application/pdf";
        if (!isImage && !isVideo && !isPdf) throw new Error("Only photos, videos and PDF files can be sent");
        if (isVideo && pendingFile.size > MAX_VIDEO_BYTES) throw new Error("Video is too large (max 50MB)");
        if (!isVideo && pendingFile.size > MAX_UPLOAD_BYTES) throw new Error("File is too large (max 10MB)");
        const toSend = isImage ? await compressImage(pendingFile) : pendingFile;
        attachment_url = await uploadUserFile(me, toSend, "chat");
        attachment_type = isImage ? "image" : isVideo ? "video" : "pdf";
        attachment_name = toSend.name;
      }
      const { data, error } = await (supabase as any)
        .from("messages")
        .insert({ sender_id: me, receiver_id: otherId, content, attachment_url, attachment_type, attachment_name })
        .select(MSG_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      setText("");
      setPendingFile(null);
      if (fileInput.current) fileInput.current.value = "";
      const m = data as Msg | null;
      if (m) {
        if (m.attachment_url) {
          const url = await getSignedUrl(m.attachment_url);
          if (url) setFileUrls((prev) => ({ ...prev, [m.attachment_url as string]: url }));
        }
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        await (supabase as any).from("notifications").insert({
          user_id: otherId,
          actor_id: me,
          type: "message",
          post_id: null,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  const visible = useMemo(() => msgs.filter((m) => !hiddenIds.has(m.id)), [msgs, hiddenIds]);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--gradient-bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur bg-background/60 border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/messages" className="text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          {other?.avatar ? (
            <img src={other.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div
              className="h-8 w-8 rounded-full grid place-items-center text-primary-foreground text-xs font-medium"
              style={{ background: "var(--gradient-glow)" }}
            >
              {(other?.name || "L").trim().charAt(0).toUpperCase()}
            </div>
          )}
          <Link to="/u/$id" params={{ id: otherId }} className="text-sm font-semibold truncate">
            {other?.name || "Lumen friend"}
          </Link>
          <span className="text-xs text-muted-foreground truncate">
            {otherTyping ? "Typing…" : lastSeenLabel(other?.lastSeen)}
          </span>
          <div className="ml-auto">
            <UserActionMenu meId={me} targetUserId={otherId} blocked={blocked} onBlockedChange={setBlocked} />
          </div>
        </div>
      </header>

      <section className="flex-1 max-w-lg w-full mx-auto px-4 py-4 space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
        {!loading && visible.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Say hello 👋</p>
        )}
        {visible.map((m) => {
          const mine = m.sender_id === me;
          const url = m.attachment_url ? fileUrls[m.attachment_url] : undefined;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[78%] space-y-1">
                <div
                  onDoubleClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                  className={`rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? "text-primary-foreground" : "bg-card border border-border"
                  } ${m.deleted_for_everyone ? "italic opacity-70" : ""}`}
                  style={mine ? { background: "var(--gradient-glow)" } : undefined}
                >
                  {m.deleted_for_everyone ? (
                    "This message was deleted"
                  ) : (
                    <>
                      {url && m.attachment_type === "image" && (
                        <img src={url} alt={m.attachment_name ?? ""} className="rounded-xl mb-1 max-h-64 object-cover" />
                      )}
                      {url && m.attachment_type === "pdf" && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 underline mb-1"
                        >
                          <FileText size={14} /> {m.attachment_name || "Document.pdf"}
                        </a>
                      )}
                      {m.content}
                    </>
                  )}
                </div>
                <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${mine ? "justify-end" : ""}`}>
                  {mine && !m.deleted_for_everyone && (
                    <span className="inline-flex items-center gap-0.5">
                      {m.read_at ? (
                        <>
                          <CheckCheck size={12} className="text-primary" /> Read
                        </>
                      ) : (
                        <>
                          <Check size={12} /> Sent
                        </>
                      )}
                    </span>
                  )}
                  {!m.deleted_for_everyone && (
                    <button
                      onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                      className="inline-flex items-center gap-0.5 hover:text-foreground"
                      aria-label="Message options"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                {menuFor === m.id && (
                  <div className={`flex gap-2 text-[11px] ${mine ? "justify-end" : ""}`}>
                    <button
                      onClick={() => deleteForMe(m)}
                      className="rounded-full border border-border bg-card px-2.5 py-1 hover:bg-accent"
                    >
                      Delete for me
                    </button>
                    {mine && (
                      <button
                        onClick={() => deleteForEveryone(m)}
                        className="rounded-full border border-border bg-card px-2.5 py-1 hover:bg-accent"
                      >
                        Delete for everyone
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {otherTyping && <p className="text-xs text-muted-foreground">Typing…</p>}
        <div ref={endRef} />
      </section>

      <form
        onSubmit={send}
        className="sticky bottom-0 backdrop-blur bg-background/70 border-t border-border"
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <label className="h-9 w-9 grid place-items-center rounded-full hover:bg-accent cursor-pointer text-muted-foreground">
            <Paperclip size={16} />
            <input
              ref={fileInput}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > MAX_UPLOAD_BYTES) {
                  toast.error("File is too large (max 10MB)");
                  return;
                }
                setPendingFile(f);
              }}
            />
          </label>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              notifyTyping();
            }}
            placeholder="Message…"
            maxLength={1000}
            className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={sending || (!text.trim() && !pendingFile)}
            className="h-9 w-9 rounded-full grid place-items-center text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </div>
        {pendingFile && (
          <p className="max-w-lg mx-auto px-4 pb-2 text-xs text-muted-foreground truncate">
            📎 {pendingFile.name}
          </p>
        )}
      </form>
    </main>
  );
}
