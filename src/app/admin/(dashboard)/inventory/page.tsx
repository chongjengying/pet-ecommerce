import Link from "next/link";
import { getProducts } from "@/services/productService";
import AdminTable from "@/components/admin/ui/AdminTable";

export const metadata = {
  title: "Inventory - Pawluxe Admin",
  description: "Inventory monitoring for Pawluxe products.",
};

export default async function AdminInventoryPage() {
  const products = await getProducts().catch(() => []);
  const lowStockItems = products.filter((product) => Number(product.stock ?? 0) <= 5);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-zinc-600">Products that need stock attention this week.</p>
        </div>
        <Link
          href="/admin/products"
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Manage Products
        </Link>
      </div>
      <AdminTable
        columns={["Product", "Stock", "Category"]}
        minWidthClassName="min-w-[640px]"
        isEmpty={lowStockItems.length === 0}
        emptyState={<p className="text-sm text-zinc-500">No low-stock products right now.</p>}
      >
        {lowStockItems.map((product) => (
          <tr key={product.id} className="border-b border-zinc-100">
            <td className="px-4 py-3 text-zinc-800">{product.name}</td>
            <td className="px-4 py-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  Number(product.stock ?? 0) <= 0
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {product.stock ?? 0}
              </span>
            </td>
            <td className="px-4 py-3 text-zinc-600">{product.category || "Uncategorized"}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
