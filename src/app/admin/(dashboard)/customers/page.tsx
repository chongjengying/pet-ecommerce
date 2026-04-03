import { getOrders } from "@/services/orderService";

export const metadata = {
  title: "Customers - Pawluxe Admin",
  description: "Customer overview for Pawluxe orders.",
};

export default async function AdminCustomersPage() {
  const orders = await getOrders().catch(() => []);
  const totalCustomers = orders.length;
  const averageOrderValue =
    orders.length > 0
      ? orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0) / orders.length
      : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Customers</h1>
        <p className="mt-1 text-sm text-zinc-600">Quick customer pulse from guest and account checkouts.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Customers (based on orders)</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{totalCustomers}</p>
        </article>
        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Average Order Value</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">RM {averageOrderValue.toFixed(2)}</p>
        </article>
      </div>
    </div>
  );
}
