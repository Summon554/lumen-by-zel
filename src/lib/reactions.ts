export const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "laugh", emoji: "😂", label: "Laugh" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "pray", emoji: "🙏", label: "Pray" },
] as const;

export type ReactionType = (typeof REACTIONS)[number]["type"];

export function emojiFor(type: string | null | undefined) {
  return REACTIONS.find((r) => r.type === type)?.emoji ?? "👍";
}

export type ReactionState = {
  counts: Record<string, number>;
  mine: ReactionType | null;
  total: number;
};

export const emptyReactionState = (): ReactionState => ({ counts: {}, mine: null, total: 0 });

export function buildReactionState(
  rows: { user_id: string; type: string }[],
  meId: string | null,
): ReactionState {
  const counts: Record<string, number> = {};
  let mine: ReactionType | null = null;
  rows.forEach((r) => {
    counts[r.type] = (counts[r.type] ?? 0) + 1;
    if (r.user_id === meId) mine = r.type as ReactionType;
  });
  return { counts, mine, total: rows.length };
}

export function applyReaction(state: ReactionState, next: ReactionType | null): ReactionState {
  const counts = { ...state.counts };
  if (state.mine) counts[state.mine] = Math.max(0, (counts[state.mine] ?? 1) - 1);
  if (next) counts[next] = (counts[next] ?? 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, mine: next, total };
}