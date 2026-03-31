import Link from "next/link";
import { getProducts } from "@/services/productService";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Edit Product – Paw & Co Admin",
  description: "Edit product.",
};

export default async function AdminEditProductPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const products = await getProducts().catch(() => []);
  const list = Array.isArray(products) ? products : [];
  const product = list.find((p: { id: string }) => String(p.id) === id);
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
      <div className="rounded-2xl border border-amber-200/60 bg-white p-8 shadow-sm">
        <p className="font-medium text-umber">{product.name}</p>
        <p className="mt-1 text-sm text-umber/70">Edit form (name, price, category, stock, image) can be added here and wired to Supabase update.</p>
        <Link
          href="/admin/products"
          className="mt-4 inline-block text-sm font-medium text-terracotta hover:underline"
        >
          ← Back to products
        </Link>
      </div>
    </div>
  );
}
