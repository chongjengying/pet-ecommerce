import AdminShell from "@/components/admin/ui/AdminShell";
import { AdminToastProvider } from "@/components/admin/ui/AdminToast";

export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <AdminToastProvider>
      <AdminShell>{children}</AdminShell>
    </AdminToastProvider>
  );
}
