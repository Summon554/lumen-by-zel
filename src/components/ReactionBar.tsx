import { useState } from "react";
import { REACTIONS, emojiFor, type ReactionState, type ReactionType } from "@/lib/reactions";

export function ReactionBar({
  state,
  onReact,
  compact = false,
}: {
  state: ReactionState;
  onReact: (type: ReactionType | null) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const top = REACTIONS.filter((r) => (state.counts[r.type] ?? 0) > 0).slice(0, 3);

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full transition ${
          compact ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"
        } ${state.mine ? "text-primary font-medium bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
        aria-label="React"
      >
        <span>{state.mine ? emojiFor(state.mine) : "🙂"}</span>
        <span>{state.mine ? REACTIONS.find((r) => r.type === state.mine)?.label : "React"}</span>
      </button>
      {state.total > 0 && (
        <span className="text-xs text-muted-foreground">
          {top.map((r) => r.emoji).join("")} {state.total}
        </span>
      )}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close reactions"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-40 bottom-full left-0 mb-2 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg">
            {REACTIONS.map((r) => (
              <button
                key={r.type}
                type="button"
                title={r.label}
                onClick={() => {
                  setOpen(false);
                  onReact(state.mine === r.type ? null : r.type);
                }}
                className={`text-lg leading-none px-1 rounded-full transition hover:scale-125 ${
                  state.mine === r.type ? "bg-primary/15" : ""
                }`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}