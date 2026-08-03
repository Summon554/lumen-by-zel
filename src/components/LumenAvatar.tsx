/** Lumen signature avatar: circular, thin #00BFFF ring, soft glow halo behind it. */
export function LumenAvatar({
  name,
  url,
  size = 48,
}: {
  name?: string | null;
  url?: string | null;
  size?: number;
}) {
  const initials = (name || "L").trim().charAt(0).toUpperCase();
  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: "0 0 14px 2px rgba(0,191,255,0.45)" }}
      />
      <span
        className="relative rounded-full overflow-hidden grid place-items-center text-primary-foreground font-medium"
        style={{
          width: size,
          height: size,
          border: "1.5px solid #00BFFF",
          background: url ? "transparent" : "var(--gradient-glow)",
          fontSize: size * 0.4,
        }}
      >
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials}
      </span>
    </span>
  );
}
