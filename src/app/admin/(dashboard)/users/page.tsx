import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import AdminUsersManager from "@/components/admin/AdminUsersManager";

export const metadata = {
  title: "Users - Pawluxe Admin",
  description: "Manage users, roles, and account status.",
};

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Access Control"
        title="Users"
        description="Create users, assign admin/customer roles, and control account status."
      />
      <AdminUsersManager />
    </div>
  );
}

