import {
  getInventorySnapshot,
  summarizeInventoryCategories,
} from "@/services/inventoryService";
import AdminTable from "@/components/admin/ui/AdminTable";

export const metadata = {
  title: "Categories - Pawluxe Admin",
  description: "Review product categories.",
};

export default async function AdminCategoriesPage() {
  const snapshot = await getInventorySnapshot().catch(() => []);
  const categories = summarizeInventoryCategories(snapshot);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Categories</h1>
        <p className="mt-1 text-sm text-zinc-600">A lightweight view of category coverage in your catalog.</p>
      </div>
      <AdminTable
        columns={["Category", "Products", "Units in stock", "Low stock", "Out of stock"]}
        minWidthClassName="min-w-[520px]"
        isEmpty={categories.length === 0}
        emptyState={<p className="text-sm text-zinc-500">No categories found yet.</p>}
      >
        {categories.map((category) => (
          <tr key={category.name} className="border-b border-zinc-100">
            <td className="px-4 py-3 text-zinc-800">{category.name}</td>
            <td className="px-4 py-3 font-medium text-zinc-900">{category.productCount}</td>
            <td className="px-4 py-3 font-medium text-zinc-900">{category.totalStock}</td>
            <td className="px-4 py-3 text-amber-700">{category.lowStockCount}</td>
            <td className="px-4 py-3 text-red-700">{category.outOfStockCount}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
