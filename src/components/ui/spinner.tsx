import clsx from "clsx";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      className={clsx("animate-spin", className ?? "size-5 text-teal")}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Loading placeholder with a moving sheen. `dark` is for dark surfaces. */
export function Skeleton({ className, dark }: { className?: string; dark?: boolean }) {
  return <div className={clsx("rounded-xl", dark ? "skeleton-dark" : "skeleton", className)} aria-hidden />;
}

/** A row of stat-tile placeholders. */
export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[104px] rounded-tile" />
      ))}
    </div>
  );
}

/** Placeholder for a page that hasn't loaded: heading, tiles, two panels. */
export function SkeletonPage({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-5" role="status" aria-label={label}>
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <SkeletonTiles />
      <div className="grid gap-5 tablet:grid-cols-3">
        <Skeleton className="h-72 rounded-soft tablet:col-span-2" />
        <Skeleton className="h-72 rounded-soft" />
      </div>
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-muted">
      <Spinner />
      <span className="text-body font-semibold">{label}</span>
    </div>
  );
}
