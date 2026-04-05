import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/ui/AdminShell";
import { AdminAuthProvider } from "@/components/admin/AdminAuthProvider";
import { AdminToastProvider } from "@/components/admin/ui/AdminToast";
import { verifyAdminAccess } from "@/lib/adminGate";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) {
    if (gate.status === 403) {
      redirect("/admin/login?forbidden=1");
    }
    if (gate.status === 503) {
      redirect("/admin/login?config=1");
    }
    redirect("/admin/login");
  }

  return (
    <AdminAuthProvider>
      <AdminToastProvider>
        <AdminShell>{children}</AdminShell>
      </AdminToastProvider>
    </AdminAuthProvider>
  );
}
