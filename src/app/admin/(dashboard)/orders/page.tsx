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
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Fulfillment</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Orders</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-600">
          Track purchases and update status — from payment to shipped.
        </p>
      </div>
      <AdminOrdersManager orders={orders} />
    </div>
  );
}
