import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";

export const metadata = {
  title: "Settings - Pawluxe Admin",
  description: "Admin preferences and store settings.",
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="System"
        title="Settings"
        description="Store preferences and operational controls for your admin team."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
          <h2 className="text-base font-semibold text-slate-900">Store Information</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>Brand name: Pawluxe</p>
            <p>Currency: MYR</p>
            <p>Region: Malaysia</p>
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
          <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
          <p className="mt-3 text-sm text-slate-600">Product stock alerts and order updates are enabled for admin users.</p>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
        <h2 className="text-base font-semibold text-slate-900">5. Account preferences</h2>
        <div className="mt-4 divide-y divide-slate-100">
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Dark mode</p>
              <p className="text-xs text-slate-500">Switch between light and dark appearance.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
              Enable
            </label>
          </div>

          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Language</p>
              <p className="text-xs text-slate-500">Choose the default UI language.</p>
            </div>
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option>English</option>
              <option>Bahasa Melayu</option>
              <option>Chinese</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Notification settings</p>
              <p className="text-xs text-slate-500">Control system alerts and updates.</p>
            </div>
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option>All notifications</option>
              <option>Important only</option>
              <option>Muted</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Privacy settings</p>
              <p className="text-xs text-slate-500">Manage profile visibility and data sharing preferences.</p>
            </div>
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option>Standard</option>
              <option>High privacy</option>
            </select>
          </div>
        </div>
      </article>
    </div>
  );
}
