import Link from "next/link";
import AdminProductForm from "@/components/admin/AdminProductForm";
import { getProducts } from "@/services/productService";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";

const defaultCategories = ["Food", "Treats", "Supplements", "Accessories", "Grooming"];

export const metadata = {
  title: "Add Product - Pawluxe Admin",
  description: "Add a new product to Pawluxe.",
};

export default async function AdminNewProductPage() {
  const products = await getProducts().catch(() => []);
  const categoryOptions = Array.from(
    new Set([...defaultCategories, ...products.map((product) => product.category).filter(Boolean)])
  ) as string[];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Add Product"
        description="Create a complete product profile for your catalog."
        actions={
          <Link href="/admin/products" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
            Back to Products
          </Link>
        }
      />
      <AdminProductForm mode="create" categoryOptions={categoryOptions} />
    </div>
  );
}
