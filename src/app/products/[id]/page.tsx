import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import { getProductById, getProducts, isRenderableProduct } from "@/services/productService";

export const dynamicParams = false;

function toValidId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return id.length > 0 ? id : null;
}

export async function generateStaticParams() {
  const products = await getProducts().catch(() => []);
  const list = Array.isArray(products) ? products : [];

  const candidateIds = list
    .map((p: { id: string | number }) => toValidId(p.id))
    .filter((id): id is string => id != null);

  const settled = await Promise.allSettled(
    candidateIds.map(async (id) => {
      const product = await getProductById(id).catch(() => null);
      return isRenderableProduct(product) ? id : null;
    })
  );

  const validIds: string[] = [];
  let droppedCount = 0;

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      validIds.push(result.value);
    } else {
      droppedCount += 1;
    }
  }

  if (droppedCount > 0) {
    console.warn(`[products/[id]] Dropped ${droppedCount} invalid product id(s) from static params`);
  }

  return validIds.map((id) => ({ id }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const safeId = toValidId(id);

  if (!safeId) {
    return {
      title: "Product not found - Pawluxe",
      description: "This product is unavailable.",
    };
  }

  const product = await getProductById(safeId).catch(() => null);

  if (!isRenderableProduct(product)) {
    return {
      title: "Product not found - Pawluxe",
      description: "This product is unavailable.",
    };
  }

  return {
    title: `${product.name} - Pawluxe`,
    description: product.description?.trim() || `Buy ${product.name} from Pawluxe.`,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const safeId = toValidId(id);

  if (!safeId) return notFound();

  const product = await getProductById(safeId).catch(() => null);

  if (!isRenderableProduct(product)) return notFound();

  return <ProductDetail product={product} relatedProducts={[]} />;
}
