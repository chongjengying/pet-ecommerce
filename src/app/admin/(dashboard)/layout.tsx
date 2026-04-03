import AdminShell from "@/components/admin/ui/AdminShell";
import { AdminAuthProvider } from "@/components/admin/AdminAuthProvider";
import { AdminToastProvider } from "@/components/admin/ui/AdminToast";

export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminToastProvider>
        <AdminShell>{children}</AdminShell>
      </AdminToastProvider>
    </AdminAuthProvider>
  );
}
