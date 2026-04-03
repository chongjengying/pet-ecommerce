export default function AdminDashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-3xl border border-zinc-200 bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-3xl border border-zinc-200 bg-white" />
    </div>
  );
}
