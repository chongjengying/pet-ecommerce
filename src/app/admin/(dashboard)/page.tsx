import Image from "next/image";
import Link from "next/link";
import { getProducts } from "@/services/productService";
import { getOrders, type OrderRow } from "@/services/orderService";
import AdminTable from "@/components/admin/ui/AdminTable";
import { formatDateKualaLumpur } from "@/lib/dateTime";

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
  const pendingOrders = orders.filter((order) => (order.status || "Pending").toLowerCase() === "pending").length;
  const completedOrders = orders.filter((order) => (order.status || "").toLowerCase() === "completed").length;
  const totalUnitsSold = orders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0),
    0
  );
  const revenue = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
  const averageOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  const today = new Date();
  const dailyRevenue = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - i));
    const key = day.toISOString().slice(0, 10);
    const value = orders
      .filter((order) => order.created_at.slice(0, 10) === key)
      .reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
    return {
      label: formatDateKualaLumpur(day, "en-MY", { weekday: "short" }),
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

  const total7DayRevenue = dailyRevenue.reduce((sum, day) => sum + day.value, 0);
  const previousWindowRevenue = orders
    .filter((order) => {
      const orderDate = new Date(order.created_at);
      const previousWindowStart = new Date(today);
      previousWindowStart.setDate(today.getDate() - 13);
      const previousWindowEnd = new Date(today);
      previousWindowEnd.setDate(today.getDate() - 7);
      return orderDate >= previousWindowStart && orderDate <= previousWindowEnd;
    })
    .reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);

  const revenueTrend =
    previousWindowRevenue > 0 ? ((total7DayRevenue - previousWindowRevenue) / previousWindowRevenue) * 100 : 0;

  const cards = [
    {
      label: "Revenue",
      value: `RM ${revenue.toFixed(2)}`,
      href: "/admin/orders",
      trend: `${revenueTrend >= 0 ? "+" : ""}${revenueTrend.toFixed(1)}% vs prior 7d`,
    },
    {
      label: "Orders",
      value: totalOrders.toLocaleString(),
      href: "/admin/orders",
      trend: `${pendingOrders} pending review`,
    },
    {
      label: "Avg Order Value",
      value: `RM ${averageOrderValue.toFixed(2)}`,
      href: "/admin/orders",
      trend: "Operational benchmark",
    },
    {
      label: "Products",
      value: productCount.toLocaleString(),
      href: "/admin/products",
      trend: `${totalUnitsSold.toLocaleString()} units sold`,
    },
  ];

  const topProducts = products
    .map((product) => {
      const sold = orders.reduce((sum, order) => {
        const matched = order.items.find((item) => String(item.id) === String(product.id));
        return sum + (matched?.quantity ?? 0);
      }, 0);

      return {
        id: product.id,
        name: product.name,
        sold,
        price: Number(product.price ?? 0),
        stock: Number(product.stock ?? 0),
      };
    })
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  const heroStats = [
    { label: "Revenue", value: `RM ${revenue.toFixed(2)}` },
    { label: "Orders", value: totalOrders.toLocaleString() },
    { label: "Products", value: productCount.toLocaleString() },
  ];

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(250,244,236,0.96),_rgba(242,235,222,0.95))] shadow-[0_18px_60px_-28px_rgba(76,64,51,0.35)]">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative px-6 py-8 sm:px-10 sm:py-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(234,184,119,0.08),transparent_35%,rgba(122,146,113,0.08)_72%,transparent)]" />
            <div className="relative">
              <span className="inline-flex rounded-full border border-amber-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/70">
                Pet commerce dashboard
              </span>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-umber sm:text-5xl">
                A warm, pet-first view of your store performance.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-umber/72 sm:text-base">
                Track sales, fulfillment, stock health, and top-selling products from a single branded workspace. The
                dashboard is designed to feel calm, premium, and easy to scan at a glance.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/admin/orders"
                  className="inline-flex items-center rounded-2xl bg-umber px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-umber/90"
                >
                  Review orders
                </Link>
                <Link
                  href="/admin/products/new"
                  className="inline-flex items-center rounded-2xl border border-amber-200 bg-white px-5 py-3 text-sm font-semibold text-umber transition hover:bg-amber-50"
                >
                  Add product
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-amber-200/80 bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-umber/45">{stat.label}</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-umber">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center bg-[linear-gradient(180deg,rgba(122,146,113,0.08),rgba(255,255,255,0.96))] px-6 py-8 sm:px-10">
            <div className="relative w-full max-w-md">
              <div className="absolute -left-2 top-8 h-20 w-20 rounded-full bg-amber-300/20 blur-2xl" />
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-sage/15 blur-2xl" />

              <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_18px_40px_-24px_rgba(44,36,32,0.45)]">
                <div className="flex items-center justify-between border-b border-amber-100 px-5 py-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-umber/45">Brand pet image</p>
                    <p className="mt-1 text-sm font-semibold text-umber">Pawluxe companion</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Live
                  </span>
                </div>

                <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_top,rgba(250,219,170,0.55),rgba(255,255,255,1)_58%)]">
                  <Image
                    src="/logo.png"
                    alt="Pawluxe pet brand image"
                    fill
                    priority
                    className="object-contain p-8"
                  />
                </div>

                <div className="grid gap-3 border-t border-amber-100 bg-cream/50 px-5 py-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-umber/45">Products</p>
                    <p className="mt-1 text-base font-semibold text-umber">{productCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-umber/45">Pending</p>
                    <p className="mt-1 text-base font-semibold text-umber">{pendingOrders}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-umber/45">Completion</p>
                    <p className="mt-1 text-base font-semibold text-umber">{completionRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, href, trend }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">{trend}</p>
            <p className="mt-4 text-xs font-semibold text-umber group-hover:text-umber/80">View details {"->"}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)] xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Sales Overview</h2>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-umber">Last 7 days</span>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-b from-amber-50 via-white to-white p-4">
            <svg viewBox="0 0 100 100" className="h-56 w-full">
              <path d={`${chartPath} L 100 100 L 0 100 Z`} className="fill-cyan-100/80" />
              <path d={chartPath} fill="none" stroke="#7a5537" strokeWidth="2.5" strokeLinecap="round" />
              {dailyRevenue.map((day, index) => {
                const x = (index / (dailyRevenue.length - 1 || 1)) * 100;
                const y = 100 - (day.value / chartMax) * 100;
                return <circle key={day.label} cx={x} cy={y} r="1.6" className="fill-umber" />;
              })}
            </svg>
            <div className="mt-3 grid grid-cols-7 text-center text-xs text-slate-500">
              {dailyRevenue.map((day) => (
                <div key={day.label}>{day.label}</div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">7-day Revenue</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">RM {total7DayRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Completion Rate</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{completionRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pending Orders</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{pendingOrders}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
            <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-4 space-y-3">
              <Link
                href="/admin/products/new"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-200 hover:bg-amber-50/60"
              >
                Add New Product
                <span>+</span>
              </Link>
              <Link
                href="/admin/orders"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-200 hover:bg-amber-50/60"
              >
                Review Orders
                <span>+</span>
              </Link>
              <Link
                href="/products"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-200 hover:bg-amber-50/60"
              >
                Open Storefront
                <span>+</span>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
            <h2 className="text-base font-semibold text-slate-900">Catalog Health</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="text-sm text-slate-600">Products with no sales</span>
                <span className="text-sm font-semibold text-slate-900">
                  {Math.max(productCount - topProducts.filter((item) => item.sold > 0).length, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="text-sm text-slate-600">Low stock products {"(< 5)"}</span>
                <span className="text-sm font-semibold text-slate-900">
                  {products.filter((product) => Number(product.stock ?? 0) > 0 && Number(product.stock ?? 0) < 5).length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="text-sm text-slate-600">Out of stock products</span>
                <span className="text-sm font-semibold text-slate-900">
                  {products.filter((product) => Number(product.stock ?? 0) <= 0).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
            View all
          </Link>
        </div>
        <AdminTable columns={["Order ID", "Customer", "Total", "Status", "Date"]} minWidthClassName="min-w-[720px]">
          {orders.slice(0, 6).map((order) => (
            <tr key={order.id} className="border-b border-slate-100">
              <td className="px-4 py-3 font-mono text-xs text-slate-700">{order.order_number ?? order.id.slice(0, 8)}</td>
              <td className="px-4 py-3 text-slate-700">Guest Checkout</td>
              <td className="px-4 py-3 font-medium text-slate-900">RM {Number(order.total_amount ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {order.status || "Pending"}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {formatDateKualaLumpur(order.created_at, "en-MY", {
                  month: "short",
                  day: "numeric",
                })}
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Top Products</h2>
          <Link href="/admin/products" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
            Manage products
          </Link>
        </div>
        <AdminTable columns={["Product", "Units Sold", "Price", "Stock"]} minWidthClassName="min-w-[680px]">
          {topProducts.length > 0 ? (
            topProducts.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-800">{item.name}</td>
                <td className="px-4 py-3 text-slate-700">{item.sold.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-700">RM {item.price.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.stock <= 0
                        ? "bg-red-100 text-red-700"
                        : item.stock < 5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {item.stock}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                No product data available yet.
              </td>
            </tr>
          )}
        </AdminTable>
      </section>
    </div>
  );
}
