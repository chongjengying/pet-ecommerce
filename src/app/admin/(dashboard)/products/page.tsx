import { getProducts } from "@/services/productService";
import AdminProductsManager from "@/components/admin/AdminProductsManager";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";

export const metadata = {
  title: "Products - Pawluxe Admin",
  description: "Manage products in Pawluxe admin.",
};

export default async function AdminProductsPage() {
  const products = await getProducts().catch(() => []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        description="Search, filter, and manage inventory with clear actions and stock visibility."
      />
      <AdminProductsManager products={products} />
    </div>
  );
}
