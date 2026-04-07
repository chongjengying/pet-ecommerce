import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import { getProductById, getProducts, getRelatedProducts } from "@/services/productService";

export async function generateStaticParams() {
  const products = await getProducts().catch(() => []);
  const list = Array.isArray(products) ? products : [];
  return list.map((p: { id: string | number }) => ({ id: String(p.id) }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, related] = await Promise.all([
    getProductById(id).catch(() => null),
    getRelatedProducts(id, 4).catch(() => []),
  ]);
  if (!product) return notFound();
  return <ProductDetail product={product} relatedProducts={related} />;
}
