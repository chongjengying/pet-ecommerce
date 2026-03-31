import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <AdminSidebar />

      {/* Main content */}
      <main className="pl-56">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-amber-200/60 bg-cream/95 px-6 backdrop-blur">
          <h1 className="text-sm font-semibold text-umber/80">Admin Dashboard</h1>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
