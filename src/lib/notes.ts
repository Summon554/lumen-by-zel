/** Shared helpers for Lumen 24-hour Notes. */
export const NOTE_MAX_CHARS = 60;

export type NotePrivacy = "public" | "followers";

export function notePrivacyLabel(p: NotePrivacy): string {
  return p === "public" ? "Everyone" : "Followers";
}
