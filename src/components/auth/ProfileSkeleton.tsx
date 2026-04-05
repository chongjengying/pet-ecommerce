/** Calm layout placeholder — no spinning logo (feels faster than heavy loaders). */
export default function ProfileSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-amber-200/60 bg-white shadow-sm"
      aria-hidden="true"
    >
      <div className="border-b border-amber-100/90 bg-gradient-to-br from-cream/80 to-amber-50/30 px-6 py-8 sm:px-10 sm:py-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-amber-100/70 sm:h-[6rem] sm:w-[6rem]" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-28 animate-pulse rounded bg-amber-100/80" />
            <div className="h-9 max-w-xs animate-pulse rounded-lg bg-amber-100/70" />
            <div className="h-4 w-40 animate-pulse rounded bg-amber-50" />
          </div>
        </div>
      </div>
      <div className="space-y-6 px-6 py-8 sm:px-10 sm:py-9">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-xl bg-cream" />
          <div className="h-24 animate-pulse rounded-xl bg-cream" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-4 w-36 animate-pulse rounded bg-amber-50" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-11 animate-pulse rounded-xl bg-amber-50/90" />
            <div className="h-11 animate-pulse rounded-xl bg-amber-50/90" />
            <div className="h-11 animate-pulse rounded-xl bg-amber-50/90" />
            <div className="h-11 animate-pulse rounded-xl bg-amber-50/90" />
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <div className="h-11 w-36 animate-pulse rounded-xl bg-umber/15" />
          <div className="h-11 w-40 animate-pulse rounded-xl bg-amber-50" />
        </div>
      </div>
      <p className="sr-only">Loading profile</p>
    </div>
  );
}
