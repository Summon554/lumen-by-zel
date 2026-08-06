/** Shared types + helpers for Lumen "Light Moments" stories. */
export type StoryKind = "photo" | "video" | "text" | "music";
export type StoryPrivacy = "public" | "friends" | "fof" | "onlyme" | "custom";

export const STORY_PRIVACY_LABELS: Record<StoryPrivacy, string> = {
  public: "Public",
  friends: "Friends",
  fof: "Friends of friends",
  onlyme: "Only me",
  custom: "Custom",
};

export const MAX_STORY_VIDEO_SECONDS = 15;

export type StickerKind = "location" | "poll" | "countdown" | "question";

export type Sticker =
  | { kind: "location"; label: string }
  | { kind: "poll"; question: string; options: [string, string] }
  | { kind: "countdown"; label: string; at: string }
  | { kind: "question"; prompt: string };

export type StoryRow = {
  id: string;
  user_id: string;
  kind: StoryKind;
  media_url: string | null;
  text_content: string | null;
  background: string | null;
  music: { title: string; artist: string; startSec: number; endSec: number } | null;
  stickers: Sticker[];
  privacy: StoryPrivacy;
  archived: boolean;
  created_at: string;
  expires_at: string;
};

export const STORY_BACKGROUNDS = [
  "linear-gradient(135deg,#00BFFF,#3AA8FF)",
  "linear-gradient(135deg,#FFD700,#FF9A3A)",
  "linear-gradient(135deg,#7ED0FF,#B79CFF)",
  "linear-gradient(135deg,#101827,#2C3E50)",
];

export function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}