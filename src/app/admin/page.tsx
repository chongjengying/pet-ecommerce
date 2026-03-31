import Link from "next/link";
import { getProducts } from "@/services/productService";

export const metadata = {
  title: "Admin Overview – Paw & Co",
  description: "Admin dashboard overview.",
};

export default async function AdminDashboardPage() {
  const products = await getProducts().catch(() => []);
  const productCount = Array.isArray(products) ? products.length : 0;
  const lowStockCount = Array.isArray(products)
    ? products.filter((p: { stock?: number }) => p.stock != null && Number(p.stock) <= 5).length
    : 0;

  const cards = [
    { label: "Total products", value: productCount, href: "/admin/products", color: "sage" },
    { label: "Low stock (≤5)", value: lowStockCount, href: "/admin/products", color: "terracotta" },
    { label: "Orders", value: "—", href: "/admin/orders", color: "umber" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-umber">Overview</h2>
        <p className="mt-1 text-sm text-umber/70">Quick stats and shortcuts for your store.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, href, color }) => (
          <Link
            key={label}
            href={href}
            className="group block rounded-2xl border border-amber-200/60 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-sm font-medium text-umber/70">{label}</p>
            <p
              className={`mt-2 text-2xl font-bold ${
                color === "sage"
                  ? "text-sage"
                  : color === "terracotta"
                    ? "text-terracotta"
                    : "text-umber"
              }`}
            >
              {value}
            </p>
            <p className="mt-2 text-xs font-medium text-umber/60 group-hover:text-umber">View →</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200/60 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-umber">Quick actions</h3>
        <ul className="mt-4 flex flex-wrap gap-3">
          <li>
            <Link
              href="/admin/products"
              className="inline-flex items-center rounded-xl bg-umber px-4 py-2 text-sm font-medium text-white hover:bg-umber/90"
            >
              Manage products
            </Link>
          </li>
          <li>
            <Link
              href="/admin/orders"
              className="inline-flex items-center rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-umber hover:bg-amber-50"
            >
              View orders
            </Link>
          </li>
          <li>
            <Link
              href="/products"
              className="inline-flex items-center rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-umber hover:bg-amber-50"
            >
              Preview shop
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
