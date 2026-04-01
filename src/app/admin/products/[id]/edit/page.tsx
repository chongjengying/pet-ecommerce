import Link from "next/link";
import { getProductById } from "@/services/productService";
import { notFound } from "next/navigation";
import AdminProductEditForm from "@/components/admin/AdminProductEditForm";

export const metadata = {
  title: "Edit Product – PAWLUXE Admin",
  description: "Edit product.",
};

export default async function AdminEditProductPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/products"
          className="text-sm font-medium text-umber/70 hover:text-umber"
        >
          ← Products
        </Link>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-umber">Edit product</h2>
      <AdminProductEditForm product={product} />
      <Link
        href="/admin/products"
        className="inline-block text-sm font-medium text-terracotta hover:underline"
      >
        ← Back to products
      </Link>
    </div>
  );
}
