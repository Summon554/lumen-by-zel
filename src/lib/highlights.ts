export type Highlight = { text: string; source: string };

/** Generic, faith-neutral inspiration. Also doubles as the app-announcement slot. */
export const HIGHLIGHTS: Highlight[] = [
  { text: "Small steps every day still add up to somewhere worth going.", source: "Lumen" },
  { text: "Be kind — everyone you meet is carrying something you can't see.", source: "Lumen" },
  { text: "Your story is still being written. Keep going.", source: "Lumen" },
  { text: "Courage is quiet. It just shows up again tomorrow.", source: "Lumen" },
  { text: "Encourage someone today; it costs nothing and changes everything.", source: "Lumen" },
  { text: "Progress beats perfection, every single time.", source: "Lumen" },
  { text: "Rest is productive. Give yourself the pause.", source: "Lumen" },
  { text: "The light you share is the light you get back.", source: "Lumen" },
  { text: "You don't have to be loud to make a difference.", source: "Lumen" },
  { text: "Celebrate the small wins — they're the real ones.", source: "Lumen" },
  { text: "Someone out there needs the exact hope you have.", source: "Lumen" },
  { text: "Start where you are, use what you have, do what you can.", source: "Lumen" },
  { text: "Be the reason someone's day feels lighter.", source: "Lumen" },
  { text: "Growth is rarely loud, but it's always happening.", source: "Lumen" },
];

/** Deterministic daily rotation — same highlight for everyone, changes at midnight local time. */
export function highlightOfTheDay(now: Date = new Date()): Highlight {
  const day = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000,
  );
  return HIGHLIGHTS[((day % HIGHLIGHTS.length) + HIGHLIGHTS.length) % HIGHLIGHTS.length];
}
