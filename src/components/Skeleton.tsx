export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/70 ${className}`} />;
}

export function PostSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-1/5" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    </div>
  );
}

export function BubbleSkeleton({ mine }: { mine?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <Skeleton className={`h-9 rounded-2xl ${mine ? "w-2/5" : "w-1/2"}`} />
    </div>
  );
}
