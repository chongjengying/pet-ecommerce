import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import { getProductById, getProducts } from "@/services/productService";

export async function generateStaticParams() {
  const products = await getProducts().catch(() => []);
  const list = Array.isArray(products) ? products : [];
  return list.map((p: { id: string | number }) => ({ id: String(p.id) }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);
  if (!product) return notFound();
  const all = await getProducts().catch(() => []);
  const related = all.filter((p) => String(p.id) !== String(id)).slice(0, 4);
  return <ProductDetail product={product} relatedProducts={related} />;
}
