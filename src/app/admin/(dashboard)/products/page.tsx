import { getProducts } from "@/services/productService";
import AdminProductsManager from "@/components/admin/AdminProductsManager";

export const metadata = {
  title: "Products - Pawluxe Admin",
  description: "Manage products in Pawluxe admin.",
};

export default async function AdminProductsPage() {
  const products = await getProducts().catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Catalog</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Products</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-600">
          Search, filter, and manage inventory — everything shoppers see on the storefront.
        </p>
      </div>
      <AdminProductsManager products={products} />
    </div>
  );
}
