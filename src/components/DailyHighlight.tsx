import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { highlightOfTheDay } from "@/lib/highlights";

/** Daily Highlight card — inspiration / announcement slot, deliberately not styled like a post. */
export function DailyHighlight() {
  const highlight = useMemo(() => highlightOfTheDay(), []);
  return (
    <section
      aria-label="Daily highlight"
      className="relative overflow-hidden rounded-3xl p-5 text-primary-foreground"
      style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
    >
      <div className="absolute -top-8 -right-6 h-28 w-28 rounded-full bg-white/25 blur-2xl animate-pulse-glow" />
      <div className="absolute -bottom-10 -left-4 h-24 w-24 rounded-full bg-white/20 blur-2xl animate-float" />
      <div className="relative">
        <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] opacity-90">
          <Sparkles size={12} /> Daily Highlight
        </p>
        <blockquote className="mt-2 text-[15px] leading-relaxed font-medium">
          “{highlight.text}”
        </blockquote>
        <p className="mt-2 text-xs opacity-90">— {highlight.source}</p>
      </div>
    </section>
  );
}
