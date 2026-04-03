import { getOrders } from "@/services/orderService";
import AdminOrdersManager from "@/components/admin/AdminOrdersManager";

export const metadata = {
  title: "Orders - Pawluxe Admin",
  description: "Manage customer orders.",
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await getOrders().catch(() => []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Orders</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Monitor incoming purchases and update fulfillment status quickly.
        </p>
      </div>
      <AdminOrdersManager orders={orders} />
    </div>
  );
}
