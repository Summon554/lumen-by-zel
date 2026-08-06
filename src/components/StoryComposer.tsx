import { useState } from "react";
import { X, Image as ImageIcon, Type, Music as MusicIcon, MapPin, BarChart3, Timer, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage, uploadUserFile } from "@/lib/storage";
import { LUMEN_LIBRARY, MAX_CLIP_SECONDS } from "@/lib/music";
import { moderate } from "@/lib/moderation";
import {
  STORY_BACKGROUNDS,
  STORY_PRIVACY_LABELS,
  MAX_STORY_VIDEO_SECONDS,
  type Sticker,
  type StoryKind,
  type StoryPrivacy,
} from "@/lib/stories";

/** Full-screen composer for a Light Moment (photo / video / text / music clip). */
export function StoryComposer({
  userId,
  defaultPrivacy,
  onClose,
  onCreated,
}: {
  userId: string;
  defaultPrivacy: StoryPrivacy;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<StoryKind>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [background, setBackground] = useState(STORY_BACKGROUNDS[0]!);
  const [trackId, setTrackId] = useState(LUMEN_LIBRARY[0]!.id);
  const [privacy, setPrivacy] = useState<StoryPrivacy>(defaultPrivacy);
  const [saveDefault, setSaveDefault] = useState(false);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [busy, setBusy] = useState(false);

  function addSticker(s: Sticker) {
    setStickers((prev) => [...prev, s]);
  }

  async function pickVideo(f: File) {
    const url = URL.createObjectURL(f);
    const el = document.createElement("video");
    el.preload = "metadata";
    const dur = await new Promise<number>((res) => {
      el.onloadedmetadata = () => res(el.duration);
      el.onerror = () => res(0);
      el.src = url;
    });
    URL.revokeObjectURL(url);
    if (dur > MAX_STORY_VIDEO_SECONDS + 0.5) {
      toast.error(`Story videos are capped at ${MAX_STORY_VIDEO_SECONDS} seconds.`);
      return;
    }
    setFile(f);
  }

  async function submit() {
    if (busy) return;
    const check = moderate(text);
    if (!check.ok) {
      toast.error(check.message ?? "This can't be posted.");
      return;
    }
    if ((kind === "photo" || kind === "video") && !file) {
      toast.error("Pick something to share first.");
      return;
    }
    if (kind === "text" && !text.trim()) {
      toast.error("Write something first.");
      return;
    }
    setBusy(true);
    try {
      let mediaPath: string | null = null;
      if (file) {
        const prepared = kind === "photo" ? await compressImage(file) : file;
        mediaPath = await uploadUserFile(userId, prepared, "stories");
      }
      let music = null as null | { title: string; artist: string; startSec: number; endSec: number };
      if (kind === "music") {
        const track = LUMEN_LIBRARY.find((t) => t.id === trackId)!;
        music = { title: track.title, artist: track.artist, startSec: 0, endSec: MAX_CLIP_SECONDS };
      }
      const { error } = await (supabase as any).from("stories").insert({
        user_id: userId,
        kind,
        media_url: mediaPath,
        text_content: text.trim() || null,
        background: kind === "text" || kind === "music" ? background : null,
        music,
        stickers,
        privacy,
      });
      if (error) throw new Error(error.message);
      if (saveDefault) {
        await (supabase as any).from("profiles").update({ default_story_privacy: privacy }).eq("id", userId);
      }
      toast.success("Light Moment shared — it lasts 24 hours.");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't share that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="mx-auto max-w-lg px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">New Light Moment</p>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent">
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 flex gap-2 text-xs">
          {(["photo", "video", "text", "music"] as StoryKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setFile(null);
              }}
              className={`rounded-full border border-border px-3 py-1.5 capitalize transition ${
                kind === k ? "text-primary-foreground" : "hover:bg-accent"
              }`}
              style={kind === k ? { background: "var(--gradient-glow)" } : undefined}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {(kind === "photo" || kind === "video") && (
            <label className="flex min-h-[140px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 text-sm text-muted-foreground">
              <ImageIcon size={16} />
              {file ? file.name : kind === "photo" ? "Choose a photo" : `Choose a video (max ${MAX_STORY_VIDEO_SECONDS}s)`}
              <input
                type="file"
                className="hidden"
                accept={kind === "photo" ? "image/*" : "video/*"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (kind === "video") void pickVideo(f);
                  else setFile(f);
                }}
              />
            </label>
          )}

          {(kind === "text" || kind === "music") && (
            <div className="rounded-2xl p-4" style={{ background }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder={kind === "music" ? "Say something about this track…" : "What's glowing today?"}
                className="w-full resize-none bg-transparent text-white outline-none placeholder:text-white/70"
              />
            </div>
          )}

          {(kind === "text" || kind === "music") && (
            <div className="flex gap-2">
              {STORY_BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  aria-label="Background"
                  onClick={() => setBackground(bg)}
                  className={`h-8 w-8 rounded-full border ${background === bg ? "border-primary" : "border-border"}`}
                  style={{ background: bg }}
                />
              ))}
            </div>
          )}

          {kind === "music" && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <MusicIcon size={14} /> Lumen Library · {MAX_CLIP_SECONDS}s clips only
              </p>
              <div className="mt-2 space-y-1">
                {LUMEN_LIBRARY.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTrackId(t.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs ${
                      trackId === t.id ? "bg-accent" : "hover:bg-accent/60"
                    }`}
                  >
                    <span className="text-foreground">
                      {t.title} · {t.artist}
                    </span>
                    <span className="text-muted-foreground">{t.license}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Full-song uploads are not allowed.</p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-xs font-medium text-foreground">Stickers</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <StickerBtn icon={<MapPin size={13} />} label="Location" onClick={() => {
                const v = window.prompt("Location");
                if (v) addSticker({ kind: "location", label: v });
              }} />
              <StickerBtn icon={<BarChart3 size={13} />} label="Poll" onClick={() => {
                const q = window.prompt("Poll question");
                if (!q) return;
                const a = window.prompt("Option 1") || "Yes";
                const b = window.prompt("Option 2") || "No";
                addSticker({ kind: "poll", question: q, options: [a, b] });
              }} />
              <StickerBtn icon={<Timer size={13} />} label="Countdown" onClick={() => {
                const l = window.prompt("Counting down to…");
                if (!l) return;
                const at = window.prompt("Date (YYYY-MM-DD)") || new Date().toISOString().slice(0, 10);
                addSticker({ kind: "countdown", label: l, at });
              }} />
              <StickerBtn icon={<HelpCircle size={13} />} label="Question" onClick={() => {
                const p = window.prompt("Ask something");
                if (p) addSticker({ kind: "question", prompt: p });
              }} />
            </div>
            {stickers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stickers.map((s, i) => (
                  <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {stickerLabel(s)}
                    <button className="ml-1" onClick={() => setStickers((p) => p.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-xs font-medium text-foreground">Who can see this</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(Object.keys(STORY_PRIVACY_LABELS) as StoryPrivacy[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrivacy(p)}
                  className={`rounded-full border border-border px-3 py-1 transition ${
                    privacy === p ? "text-primary-foreground" : "hover:bg-accent"
                  }`}
                  style={privacy === p ? { background: "var(--gradient-glow)" } : undefined}
                >
                  {STORY_PRIVACY_LABELS[p]}
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} />
              Save as my default
            </label>
          </div>

          <button
            onClick={submit}
            disabled={busy}
            className="w-full rounded-full px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
          >
            {busy ? "Sharing…" : "Share Light Moment"}
          </button>
          <p className="pb-6 text-center text-[11px] text-muted-foreground">
            Disappears from the bar after 24 hours and moves to your private archive.
          </p>
        </div>
      </div>
    </div>
  );
}

function StickerBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:bg-accent">
      {icon}
      {label}
    </button>
  );
}

export function stickerLabel(s: Sticker): string {
  if (s.kind === "location") return `📍 ${s.label}`;
  if (s.kind === "poll") return `📊 ${s.question}`;
  if (s.kind === "countdown") return `⏳ ${s.label}`;
  return `❓ ${s.prompt}`;
}