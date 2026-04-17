import { getOrders } from "@/services/orderService";
import AdminOrdersManager from "@/components/admin/AdminOrdersManager";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";

export const metadata = {
  title: "Orders - Pawluxe Admin",
  description: "Manage customer orders.",
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await getOrders().catch(() => []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Fulfillment"
        title="Orders"
        description="Track purchases and update status from payment to shipped."
      />
      <AdminOrdersManager orders={orders} />
    </div>
  );
}
