import { supabase } from "@/integrations/supabase/client";
import { moderate } from "@/lib/moderation";

/** Sends a DM that quotes a story or note so the chat shows the context above the reply. */
export async function sendQuickReply(opts: {
  from: string;
  to: string;
  kind: "story" | "note";
  quote: string;
  content: string;
}) {
  const content = opts.content.trim();
  if (!content) throw new Error("Write a reply first");
  const verdict = moderate(content);
  if (!verdict.ok) throw new Error(verdict.message ?? "That reply can't be sent.");
  const { error } = await (supabase as any).from("messages").insert({
    sender_id: opts.from,
    receiver_id: opts.to,
    content: content.slice(0, 1000),
    quote_kind: opts.kind,
    quote_text: `${opts.kind === "story" ? "Replied to your story" : "Replied to your note"}: ${opts.quote}`.slice(0, 140),
  });
  if (error) throw error;
}
