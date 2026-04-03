import Link from "next/link";
import { getProducts } from "@/services/productService";
import { getOrders, type OrderRow } from "@/services/orderService";
import AdminTable from "@/components/admin/ui/AdminTable";

export const metadata = {
  title: "Dashboard - Pawluxe Admin",
  description: "Pawluxe admin dashboard overview.",
};

export default async function AdminDashboardPage() {
  const [products, orders] = await Promise.all([
    getProducts().catch(() => []),
    getOrders().catch(() => [] as OrderRow[]),
  ]);

  const productCount = products.length;
  const totalOrders = orders.length;
  const totalUnitsSold = orders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0),
    0
  );
  const revenue = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);

  const today = new Date();
  const dailyRevenue = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - i));
    const key = day.toISOString().slice(0, 10);
    const value = orders
      .filter((order) => order.created_at.slice(0, 10) === key)
      .reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
    return {
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      value,
    };
  });

  const chartMax = Math.max(...dailyRevenue.map((day) => day.value), 1);
  const chartPath = dailyRevenue
    .map((day, index) => {
      const x = (index / (dailyRevenue.length - 1 || 1)) * 100;
      const y = 100 - (day.value / chartMax) * 100;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const cards = [
    { label: "Total Sales", value: totalUnitsSold.toLocaleString(), href: "/admin/orders" },
    { label: "Orders", value: totalOrders.toLocaleString(), href: "/admin/orders" },
    { label: "Revenue", value: `RM ${revenue.toFixed(2)}`, href: "/admin/orders" },
    { label: "Products", value: productCount.toLocaleString(), href: "/admin/products" },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">A quick snapshot of your Pawluxe store performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-medium text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
            <p className="mt-3 text-xs font-medium text-emerald-700">View details</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Sales Overview</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Last 7 days
            </span>
          </div>
          <div className="mt-6 rounded-2xl bg-gradient-to-b from-[#e9f7ee] via-[#f6f8f3] to-white p-4">
            <svg viewBox="0 0 100 100" className="h-52 w-full">
              <path d={`${chartPath} L 100 100 L 0 100 Z`} className="fill-emerald-100" />
              <path d={chartPath} fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />
              {dailyRevenue.map((day, index) => {
                const x = (index / (dailyRevenue.length - 1 || 1)) * 100;
                const y = 100 - (day.value / chartMax) * 100;
                return <circle key={day.label} cx={x} cy={y} r="1.6" className="fill-emerald-700" />;
              })}
            </svg>
            <div className="mt-3 grid grid-cols-7 text-center text-xs text-zinc-500">
              {dailyRevenue.map((day) => (
                <div key={day.label}>{day.label}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Quick Actions</h2>
          <div className="mt-4 space-y-3">
            <Link
              href="/admin/products/new"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-200 hover:bg-emerald-50"
            >
              Add New Product
              <span>+</span>
            </Link>
            <Link
              href="/admin/orders"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-200 hover:bg-emerald-50"
            >
              Review Orders
              <span>+</span>
            </Link>
            <Link
              href="/products"
              className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-200 hover:bg-emerald-50"
            >
              Open Storefront
              <span>+</span>
            </Link>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
            View all
          </Link>
        </div>
        <AdminTable columns={["Order ID", "Customer", "Total", "Status", "Date"]} minWidthClassName="min-w-[720px]">
          {orders.slice(0, 6).map((order) => (
            <tr key={order.id} className="border-b border-zinc-100">
              <td className="px-4 py-3 font-mono text-xs text-zinc-700">{order.order_number ?? order.id.slice(0, 8)}</td>
              <td className="px-4 py-3 text-zinc-700">Guest Checkout</td>
              <td className="px-4 py-3 font-medium text-zinc-900">RM {Number(order.total_amount ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                  {order.status || "Pending"}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-500">
                {new Date(order.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}
