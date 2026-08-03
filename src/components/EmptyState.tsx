import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-8 text-center">
      <div
        className="mx-auto h-14 w-14 rounded-full grid place-items-center text-primary-foreground mb-3"
        style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}
      >
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
