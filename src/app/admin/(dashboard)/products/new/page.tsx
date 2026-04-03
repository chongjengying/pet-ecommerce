import Link from "next/link";
import AdminProductForm from "@/components/admin/AdminProductForm";
import { getProducts } from "@/services/productService";

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
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Add Product</h1>
          <p className="mt-1 text-sm text-zinc-600">Create a complete product profile for your catalog.</p>
        </div>
        <Link href="/admin/products" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          Back to Products
        </Link>
      </div>
      <AdminProductForm mode="create" categoryOptions={categoryOptions} />
    </div>
  );
}
