import Link from "next/link";
import { getInventorySnapshot } from "@/services/inventoryService";
import AdminTable from "@/components/admin/ui/AdminTable";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";

export const metadata = {
  title: "Inventory - Pawluxe Admin",
  description: "Inventory monitoring for Pawluxe products.",
};

export default async function AdminInventoryPage() {
  const snapshot = await getInventorySnapshot().catch(() => []);
  const lowStockItems = snapshot.filter((item) => item.stock <= 5);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Products that need stock attention this week."
        actions={
          <Link
            href="/admin/products"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Manage Products
          </Link>
        }
      />

      <AdminTable
        columns={["Product", "Stock", "Category"]}
        minWidthClassName="min-w-[640px]"
        isEmpty={lowStockItems.length === 0}
        emptyState={<p className="text-sm text-slate-500">No low-stock products right now.</p>}
      >
        {lowStockItems.map((product) => (
          <tr key={product.id} className="border-b border-slate-100">
            <td className="px-4 py-3 text-slate-800">{product.name}</td>
            <td className="px-4 py-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  product.stock <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {product.stock}
              </span>
            </td>
            <td className="px-4 py-3 text-slate-600">{product.category}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
