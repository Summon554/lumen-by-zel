import { useEffect, useState } from "react";
import { X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { LumenAvatar } from "@/components/LumenAvatar";
import { stickerLabel } from "@/components/StoryComposer";
import { STORY_PRIVACY_LABELS, timeLeft, type StoryRow } from "@/lib/stories";

/** Full-screen story player. Tap right/left to move between a user's stories. */
export function StoryViewer({
  stories,
  authorName,
  authorAvatar,
  meId,
  onClose,
}: {
  stories: StoryRow[];
  authorName: string | null;
  authorAvatar: string | null;
  meId: string | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [viewers, setViewers] = useState<{ id: string; name: string | null }[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const story = stories[index];
  const isOwner = !!meId && !!story && story.user_id === meId;

  useEffect(() => {
    if (!story) return;
    setMediaUrl(null);
    if (story.media_url) void getSignedUrl(story.media_url).then(setMediaUrl);
    if (meId && !isOwner) {
      void (supabase as any).from("story_views").insert({ story_id: story.id, viewer_id: meId });
    }
  }, [story?.id, meId, isOwner]);

  useEffect(() => {
    if (!isOwner || !story) return;
    (async () => {
      const { data } = await (supabase as any).from("story_views").select("viewer_id").eq("story_id", story.id);
      const ids = ((data ?? []) as { viewer_id: string }[]).map((v) => v.viewer_id);
      if (ids.length === 0) return setViewers([]);
      const { data: profs } = await supabase.from("profiles").select("id,name").in("id", ids);
      setViewers((profs ?? []) as { id: string; name: string | null }[]);
    })();
  }, [story?.id, isOwner]);

  if (!story) return null;

  function step(dir: 1 | -1) {
    const next = index + dir;
    if (next < 0) return;
    if (next >= stories.length) return onClose();
    setIndex(next);
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <div className="flex items-center gap-2 px-3 py-3">
        <LumenAvatar name={authorName} url={authorAvatar} size={36} />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{authorName || "Lumen friend"}</p>
          <p className="text-[11px] text-white/70">
            {timeLeft(story.expires_at)} · {STORY_PRIVACY_LABELS[story.privacy]}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close story" className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/10">
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1">
        <div className="absolute inset-0 grid place-items-center p-4">
          {story.kind === "photo" && mediaUrl && <img src={mediaUrl} alt="Story" className="max-h-full max-w-full rounded-2xl object-contain" />}
          {story.kind === "video" && mediaUrl && (
            <video src={mediaUrl} autoPlay controls playsInline className="max-h-full max-w-full rounded-2xl" />
          )}
          {(story.kind === "text" || story.kind === "music") && (
            <div
              className="grid h-full w-full place-items-center rounded-2xl p-6 text-center"
              style={{ background: story.background ?? "linear-gradient(135deg,#00BFFF,#3AA8FF)" }}
            >
              <div>
                <p className="text-xl font-medium text-white">{story.text_content}</p>
                {story.music && (
                  <p className="mt-3 text-xs text-white/80">
                    ♪ {story.music.title} · {story.music.artist} ({Math.round(story.music.endSec - story.music.startSec)}s clip)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {story.stickers?.length > 0 && (
          <div className="pointer-events-none absolute bottom-16 left-0 right-0 flex flex-wrap justify-center gap-2 px-4">
            {story.stickers.map((s, i) => (
              <span key={i} className="rounded-full bg-white/90 px-3 py-1 text-xs text-black">
                {stickerLabel(s)}
              </span>
            ))}
          </div>
        )}

        <button aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" onClick={() => step(-1)} />
        <button aria-label="Next" className="absolute inset-y-0 right-0 w-1/3" onClick={() => step(1)} />
      </div>

      {isOwner && (
        <div className="border-t border-white/10 px-4 py-3">
          <button onClick={() => setShowViewers((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-white/80">
            <Eye size={14} /> {viewers.length} viewer{viewers.length === 1 ? "" : "s"}
          </button>
          {showViewers && (
            <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-white/70">
              {viewers.length === 0 && <p>No views yet.</p>}
              {viewers.map((v) => (
                <p key={v.id}>{v.name || "Lumen friend"}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center gap-1 pb-3">
        {stories.map((_, i) => (
          <span key={i} className={`h-1 w-6 rounded-full ${i <= index ? "bg-white" : "bg-white/30"}`} />
        ))}
      </div>
    </div>
  );
}