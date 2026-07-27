import { Crown } from "lucide-react";

export function FounderBadge({ size = 14, showLabel = true }: { size?: number; showLabel?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        background: "linear-gradient(135deg, #FFD700, #FFB800)",
        color: "#4a3200",
        boxShadow: "0 0 8px rgba(255,215,0,0.55)",
      }}
      title="Lumen Founder"
    >
      <Crown size={size - 2} />
      {showLabel && <span>Founder</span>}
    </span>
  );
}