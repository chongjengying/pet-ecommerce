import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import { resolveProductImageUrl } from "@/lib/productImage";
import { getProductById, getProductBySlug, getProducts, isRenderableProduct } from "@/services/productService";

export const dynamicParams = true;
export const revalidate = 60;

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const siteName = "PAWLUXE";

function toValidId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return id.length > 0 ? id : null;
}

function buildProductUrl(id: string): string {
  return `${siteUrl}/products/${encodeURIComponent(id)}`;
}

function getProductPath(input: { id?: string | number; slug?: string | null }, fallback: string): string {
  const slug = String(input?.slug ?? "").trim();
  if (slug) return `/products/${encodeURIComponent(slug)}`;
  return `/products/${encodeURIComponent(fallback)}`;
}

export async function generateStaticParams() {
  const products = await getProducts().catch(() => []);
  const list = Array.isArray(products) ? products : [];

  const candidateIds = list
    .map((p: { id: string | number; slug?: string | null }) => toValidId(p.slug ?? p.id))
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
      title: "Product not found | PAWLUXE",
      description: "This product is unavailable.",
      robots: { index: false, follow: true },
    };
  }

  const product =
    (await getProductById(safeId).catch(() => null)) ??
    (await getProductBySlug(safeId).catch(() => null));

  if (!isRenderableProduct(product)) {
    return {
      title: "Product not found | PAWLUXE",
      description: "This product is unavailable.",
      robots: { index: false, follow: true },
    };
  }

  const canonicalPath = getProductPath(product, safeId);
  const productUrl = `${siteUrl}${canonicalPath}`;
  const imageUrl = resolveProductImageUrl(product);
  const title = `${product.name} | ${siteName}`;
  const description = product.description?.trim() || `Buy ${product.name} from ${siteName}.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: productUrl,
      type: "website",
      siteName,
      images: imageUrl ? [{ url: imageUrl, alt: product.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const safeId = toValidId(id);

  if (!safeId) return notFound();

  const product =
    (await getProductById(safeId).catch(() => null)) ??
    (await getProductBySlug(safeId).catch(() => null));

  if (!isRenderableProduct(product)) return notFound();
  const canonicalPath = getProductPath(product, safeId);
  if (canonicalPath !== `/products/${encodeURIComponent(safeId)}`) {
    redirect(canonicalPath);
  }

  const imageUrl = resolveProductImageUrl(product);
  const productUrl = buildProductUrl(String(product.slug ?? safeId));
  const stock = Number(product.stock ?? 0);
  const hasStock = Number.isFinite(stock) && stock > 0;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description?.trim() || undefined,
    category: product.category || undefined,
    image: imageUrl ? [imageUrl] : undefined,
    sku: String(product.id),
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "MYR",
      price: Number(product.price ?? 0).toFixed(2),
      availability: hasStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <ProductDetail product={product} relatedProducts={[]} />
    </>
  );
}
