import { useRef, useState } from "react";
import { REACTIONS, emojiFor, type ReactionState, type ReactionType } from "@/lib/reactions";

export function ReactionBar({
  state,
  onReact,
  compact = false,
  prayerMode = false,
}: {
  state: ReactionState;
  onReact: (type: ReactionType | null) => void;
  compact?: boolean;
  /** Prayer / encouragement request posts get a single dedicated action. */
  prayerMode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState<{ id: number; emoji: string } | null>(null);
  const [bounce, setBounce] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const top = REACTIONS.filter((r) => (state.counts[r.type] ?? 0) > 0).slice(0, 3);

  function fire(type: ReactionType | null) {
    if (type) {
      setBurst({ id: Date.now(), emoji: emojiFor(type) });
      setBounce(true);
      setTimeout(() => setBounce(false), 420);
      setTimeout(() => setBurst(null), 900);
    }
    onReact(type);
  }

  function startPress() {
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      setOpen(true);
    }, 500);
  }
  function endPress() {
    if (timer.current) clearTimeout(timer.current);
  }

  if (prayerMode) {
    const praying = state.mine === "pray";
    return (
      <div className="relative inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => fire(praying ? null : "pray")}
          className={`inline-flex items-center gap-1.5 rounded-full transition ${
            compact ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
          } ${praying ? "text-primary font-medium bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
        >
          <span className={bounce ? "animate-reaction-bounce" : ""}>🙏</span>
          <span>{praying ? "Praying for you" : "Pray"}</span>
        </button>
        {(state.counts.pray ?? 0) > 0 && (
          <span className="text-xs text-muted-foreground">{state.counts.pray}</span>
        )}
        {burst && (
          <span key={burst.id} className="pointer-events-none absolute left-3 -top-1 text-xl animate-float-up">
            {burst.emoji}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longFired.current) return;
          setOpen((o) => !o);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full transition select-none ${
          compact ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"
        } ${state.mine ? "text-primary font-medium bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
        aria-label="React — hold for more reactions"
        title="Hold for more reactions"
      >
        <span className={bounce ? "animate-reaction-bounce inline-block" : "inline-block"}>
          {state.mine ? emojiFor(state.mine) : "😊"}
        </span>
        <span>{state.mine ? REACTIONS.find((r) => r.type === state.mine)?.label : "React"}</span>
      </button>
      {state.total > 0 && (
        <span className="text-xs text-muted-foreground">
          {top.map((r) => r.emoji).join("")} {state.total}
        </span>
      )}
      {burst && (
        <span key={burst.id} className="pointer-events-none absolute left-3 -top-1 text-xl animate-float-up">
          {burst.emoji}
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
          <div className="absolute z-40 bottom-full left-0 mb-2 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg animate-reaction-pop">
            {REACTIONS.map((r, i) => (
              <button
                key={r.type}
                type="button"
                title={r.label}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => {
                  setOpen(false);
                  fire(state.mine === r.type ? null : r.type);
                }}
                className={`text-lg leading-none px-1 rounded-full transition hover:scale-125 animate-reaction-pop ${
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
