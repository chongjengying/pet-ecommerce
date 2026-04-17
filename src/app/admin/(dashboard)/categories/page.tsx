import { getInventorySnapshot, summarizeInventoryCategories } from "@/services/inventoryService";
import AdminTable from "@/components/admin/ui/AdminTable";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";

export const metadata = {
  title: "Categories - Pawluxe Admin",
  description: "Review product categories.",
};

export default async function AdminCategoriesPage() {
  const snapshot = await getInventorySnapshot().catch(() => []);
  const categories = summarizeInventoryCategories(snapshot);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Quick view of category coverage and stock distribution in your catalog."
      />
      <AdminTable
        columns={["Category", "Products", "Units in stock", "Low stock", "Out of stock"]}
        minWidthClassName="min-w-[620px]"
        isEmpty={categories.length === 0}
        emptyState={<p className="text-sm text-slate-500">No categories found yet.</p>}
      >
        {categories.map((category) => (
          <tr key={category.name} className="border-b border-slate-100">
            <td className="px-4 py-3 text-slate-800">{category.name}</td>
            <td className="px-4 py-3 font-medium text-slate-900">{category.productCount}</td>
            <td className="px-4 py-3 font-medium text-slate-900">{category.totalStock}</td>
            <td className="px-4 py-3 text-amber-700">{category.lowStockCount}</td>
            <td className="px-4 py-3 text-red-700">{category.outOfStockCount}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
