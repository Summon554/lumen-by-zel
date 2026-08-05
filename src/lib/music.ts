/** Lumen Music Library — public-domain / freely licensed instrumentals only. */
export const MAX_CLIP_SECONDS = 15;

export type Track = { id: string; title: string; artist: string; license: string; durationSec: number };

export const LUMEN_LIBRARY: Track[] = [
  { id: "dawn", title: "Dawn Light", artist: "Lumen Sounds", license: "CC0", durationSec: 92 },
  { id: "still", title: "Still Waters", artist: "Lumen Sounds", license: "CC0", durationSec: 120 },
  { id: "hope", title: "Quiet Hope", artist: "Lumen Sounds", license: "CC0", durationSec: 105 },
];