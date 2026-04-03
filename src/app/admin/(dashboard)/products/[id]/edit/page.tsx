import Link from "next/link";
import { notFound } from "next/navigation";
import AdminProductForm from "@/components/admin/AdminProductForm";
import { getProductById, getProducts } from "@/services/productService";

const defaultCategories = ["Food", "Treats", "Supplements", "Accessories", "Grooming"];

export const metadata = {
  title: "Edit Product - Pawluxe Admin",
  description: "Edit product details in Pawluxe admin.",
};

export default async function AdminEditProductPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, products] = await Promise.all([
    getProductById(id).catch(() => null),
    getProducts().catch(() => []),
  ]);

  if (!product) notFound();

  const categoryOptions = Array.from(
    new Set([...defaultCategories, ...products.map((entry) => entry.category).filter(Boolean)])
  ) as string[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Edit Product</h1>
          <p className="mt-1 text-sm text-zinc-600">Update product details and media in one place.</p>
        </div>
        <Link href="/admin/products" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          Back to Products
        </Link>
      </div>
      <AdminProductForm mode="edit" product={product} categoryOptions={categoryOptions} />
    </div>
  );
}
