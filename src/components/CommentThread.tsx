import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { moderate } from "@/lib/moderation";
import { toast } from "sonner";
import { FounderBadge } from "@/components/FounderBadge";
import { ReactionBar } from "@/components/ReactionBar";
import {
  applyReaction,
  buildReactionState,
  emptyReactionState,
  type ReactionState,
  type ReactionType,
} from "@/lib/reactions";

export type ThreadComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
};
export type CommentAuthor = {
  id: string;
  name: string | null;
  is_founder: boolean | null;
  avatar_url: string | null;
};
export type CommentLikeState = { count: number; likedByMe: boolean };

export function CommentThread({
  postId,
  postAuthorId,
  meId,
  comments,
  likes,
  profiles,
  avatarLookup,
  onLocalAdd,
  onLocalLikeChange,
}: {
  postId: string;
  postAuthorId: string;
  meId: string | null;
  comments: ThreadComment[];
  likes: Record<string, CommentLikeState>;
  profiles: Record<string, CommentAuthor>;
  avatarLookup: Record<string, string>;
  onLocalAdd: (comment: ThreadComment) => void;
  onLocalLikeChange: (commentId: string, next: CommentLikeState) => void;
}) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [reactions, setReactions] = useState<Record<string, ReactionState>>({});

  const commentIdsKey = comments.map((c) => c.id).join(",");
  useEffect(() => {
    const ids = commentIdsKey ? commentIdsKey.split(",") : [];
    if (ids.length === 0) {
      setReactions({});
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("comment_reactions")
        .select("comment_id,user_id,type")
        .in("comment_id", ids);
      const grouped: Record<string, { user_id: string; type: string }[]> = {};
      (data ?? []).forEach((r: any) => {
        (grouped[r.comment_id] ||= []).push({ user_id: r.user_id, type: r.type });
      });
      const next: Record<string, ReactionState> = {};
      ids.forEach((id) => (next[id] = buildReactionState(grouped[id] ?? [], meId)));
      setReactions(next);
    })();
  }, [commentIdsKey, meId]);

  async function reactToComment(c: ThreadComment, type: ReactionType | null) {
    if (!meId) return;
    const cur = reactions[c.id] ?? emptyReactionState();
    setReactions((prev) => ({ ...prev, [c.id]: applyReaction(cur, type) }));
    if (type === null) {
      await (supabase as any).from("comment_reactions").delete().eq("comment_id", c.id).eq("user_id", meId);
      return;
    }
    const { error } = await (supabase as any)
      .from("comment_reactions")
      .upsert({ comment_id: c.id, user_id: meId, type }, { onConflict: "user_id,comment_id" });
    if (error) {
      setReactions((prev) => ({ ...prev, [c.id]: cur }));
      toast.error(error.message);
    }
  }

  const { roots, childrenOf } = useMemo(() => {
    const roots: ThreadComment[] = [];
    const childrenOf: Record<string, ThreadComment[]> = {};
    comments.forEach((c) => {
      if (c.parent_id) (childrenOf[c.parent_id] ||= []).push(c);
      else roots.push(c);
    });
    return { roots, childrenOf };
  }, [comments]);

  async function submit(content: string, parentId: string | null, recipientId: string) {
    if (!meId || !content.trim()) return;
    const check = moderate(content);
    if (!check.ok) {
      toast.error(check.message!);
      return;
    }
    const { data, error } = await (supabase as any)
      .from("comments")
      .insert({ post_id: postId, user_id: meId, content: content.trim(), parent_id: parentId })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    onLocalAdd(data as ThreadComment);
    if (recipientId && recipientId !== meId) {
      await (supabase as any).from("notifications").insert({
        user_id: recipientId,
        actor_id: meId,
        type: parentId ? "comment_reply" : "comment",
        post_id: postId,
      });
    }
  }

  function CommentRow({ c, indented }: { c: ThreadComment; indented?: boolean }) {
    const p = profiles[c.user_id];
    const av = p?.avatar_url ? avatarLookup[p.avatar_url] : undefined;
    void likes;
    void onLocalLikeChange;
    const rx = reactions[c.id] ?? emptyReactionState();
    return (
      <div className={indented ? "flex items-start gap-2 ml-9" : "flex items-start gap-2"}>
        {av ? (
          <img src={av} alt="" className="rounded-full object-cover" style={{ width: indented ? 24 : 28, height: indented ? 24 : 28 }} />
        ) : (
          <div
            className="rounded-full grid place-items-center text-primary-foreground font-medium"
            style={{
              width: indented ? 24 : 28,
              height: indented ? 24 : 28,
              background: "var(--gradient-glow)",
              fontSize: indented ? 10 : 12,
            }}
          >
            {(p?.name || "L").trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl bg-background/60 px-3 py-2">
            <p className="text-xs font-medium flex items-center gap-1">
              {p?.name || "Lumen friend"}
              {p?.is_founder && <FounderBadge size={10} showLabel={false} />}
            </p>
            <p className="text-sm whitespace-pre-wrap">{c.content}</p>
          </div>
          <div className="flex items-center gap-3 pl-1 mt-1 text-[11px] text-muted-foreground">
            <ReactionBar compact state={rx} onReact={(t) => reactToComment(c, t)} />
            {!indented && (
              <button
                onClick={() => {
                  setReplyTo(replyTo === c.id ? null : c.id);
                  setReplyText("");
                }}
                className="hover:text-foreground transition"
              >
                Reply
              </button>
            )}
          </div>
          {!indented && replyTo === c.id && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(replyText, c.id, c.user_id);
                setReplyText("");
                setReplyTo(null);
              }}
              className="flex items-center gap-2 mt-2"
            >
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${p?.name || "friend"}…`}
                maxLength={500}
                className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="h-8 w-8 grid place-items-center rounded-full text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--gradient-glow)" }}
                aria-label="Send reply"
              >
                <Send size={12} />
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {roots.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
      {roots.map((c) => (
        <div key={c.id} className="space-y-2">
          <CommentRow c={c} />
          {(childrenOf[c.id] ?? []).map((r) => (
            <CommentRow key={r.id} c={r} indented />
          ))}
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text, null, postAuthorId);
          setText("");
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="h-9 w-9 grid place-items-center rounded-full text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-glow)" }}
          aria-label="Send comment"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}