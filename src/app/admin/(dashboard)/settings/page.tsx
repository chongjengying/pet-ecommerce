export const metadata = {
  title: "Settings - Pawluxe Admin",
  description: "Admin preferences and store settings.",
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600">Store preferences and control center for your team.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Store Information</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Brand name: Pawluxe
            <br />
            Currency: MYR
            <br />
            Region: Malaysia
          </p>
        </article>
        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Notifications</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Product stock alerts and order updates are enabled for admin users.
          </p>
        </article>
      </div>
    </div>
  );
}
