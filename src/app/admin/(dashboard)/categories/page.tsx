import { getProducts } from "@/services/productService";
import AdminTable from "@/components/admin/ui/AdminTable";

export const metadata = {
  title: "Categories - Pawluxe Admin",
  description: "Review product categories.",
};

export default async function AdminCategoriesPage() {
  const products = await getProducts().catch(() => []);
  const categoryMap = new Map<string, number>();
  for (const product of products) {
    const category = (product.category ?? "Uncategorized").trim() || "Uncategorized";
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
  }
  const categories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Categories</h1>
        <p className="mt-1 text-sm text-zinc-600">A lightweight view of category coverage in your catalog.</p>
      </div>
      <AdminTable
        columns={["Category", "Products"]}
        minWidthClassName="min-w-[520px]"
        isEmpty={categories.length === 0}
        emptyState={<p className="text-sm text-zinc-500">No categories found yet.</p>}
      >
        {categories.map(([name, count]) => (
          <tr key={name} className="border-b border-zinc-100">
            <td className="px-4 py-3 text-zinc-800">{name}</td>
            <td className="px-4 py-3 font-medium text-zinc-900">{count}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
