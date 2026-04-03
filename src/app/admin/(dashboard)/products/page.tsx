import { getProducts } from "@/services/productService";
import AdminProductsManager from "@/components/admin/AdminProductsManager";

export const metadata = {
  title: "Products - Pawluxe Admin",
  description: "Manage products in Pawluxe admin.",
};

export default async function AdminProductsPage() {
  const products = await getProducts().catch(() => []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Products</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Keep your catalog clean, accurate, and ready for checkout.
        </p>
      </div>
      <AdminProductsManager products={products} />
    </div>
  );
}
