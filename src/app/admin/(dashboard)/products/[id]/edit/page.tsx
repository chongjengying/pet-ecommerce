import Link from "next/link";
import { notFound } from "next/navigation";
import AdminProductForm from "@/components/admin/AdminProductForm";
import { getProductById, getProducts } from "@/services/productService";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";

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
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Edit Product"
        description="Update product details and media in one place."
        actions={
          <Link href="/admin/products" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">
            Back to Products
          </Link>
        }
      />
      <AdminProductForm mode="edit" product={product} categoryOptions={categoryOptions} />
    </div>
  );
}
