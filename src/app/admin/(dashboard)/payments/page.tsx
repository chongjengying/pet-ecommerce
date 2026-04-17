import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import AdminPaymentsManager from "@/components/admin/AdminPaymentsManager";

export const metadata = {
  title: "Payments - Pawluxe Admin",
  description: "Review payment transactions, statuses, and manual checks.",
};

export default function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Finance"
        title="Payments"
        description="Track transactions, payment status, refunds, and review outcomes from one operational view."
      />
      <AdminPaymentsManager />
    </div>
  );
}

