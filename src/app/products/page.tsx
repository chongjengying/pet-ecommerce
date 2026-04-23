import type { Metadata } from "next";
import SearchSection from "@/components/SearchSection";
import Link from "next/link";
import { getProductsPage, searchProducts } from "@/services/productService";
import type { Product } from "@/types";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const siteName = "PAWLUXE";

/** Use ISR cache to reduce repeated Supabase fetch latency. */
export const revalidate = 60;

type ProductsPageProps = {
  searchParams?:
    | {
        q?: string;
        page?: string;
      }
    | Promise<{
        q?: string;
        page?: string;
      }>;
};

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const params = await Promise.resolve(searchParams ?? {});
  const keyword = String(params.q ?? "").trim();
  const currentPage = Math.max(1, Math.floor(Number(params.page ?? "1")));
  const baseTitle = "Pet Products";
  const pageSuffix = currentPage > 1 ? ` - Page ${currentPage}` : "";
  const querySuffix = keyword ? ` for \"${keyword}\"` : "";
  const title = `${baseTitle}${querySuffix}${pageSuffix} | ${siteName}`;
  const description = keyword
    ? `Browse ${siteName} pet products matching \"${keyword}\", including food, toys, and care essentials.`
    : `Shop ${siteName} pet food, toys, bedding, and daily care essentials for cats and dogs.`;
  const canonicalPath = `/products${currentPage > 1 ? `?page=${currentPage}` : ""}`;
  const url = `${siteUrl}${canonicalPath}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: keyword
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await Promise.resolve(searchParams ?? {});
  const initialKeyword = String(params.q ?? "").trim();
  const currentPage = Math.max(1, Math.floor(Number(params.page ?? "1")));
  const pageSize = 24;
  const pageResult = initialKeyword
    ? await (async () => {
        const [items, nextProbe] = await Promise.all([
          searchProducts(initialKeyword, { page: currentPage, pageSize }),
          searchProducts(initialKeyword, { page: currentPage + 1, pageSize: 1 }),
        ]);
        return {
          items,
          hasNextPage: nextProbe.length > 0,
        };
      })()
    : await getProductsPage({ page: currentPage, pageSize });
  const products: Product[] = pageResult.items;
  const hasNextPage = pageResult.hasNextPage;
  const canonicalPath = `/products${currentPage > 1 ? `?page=${currentPage}` : ""}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "PAWLUXE Products",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: products.length,
    itemListElement: products.map((p, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${siteUrl}/products/${encodeURIComponent(String(p.slug ?? p.id))}`,
      name: p.name,
    })),
  };
  const prevHref = currentPage > 1
    ? `/products?page=${currentPage - 1}${initialKeyword ? `&q=${encodeURIComponent(initialKeyword)}` : ""}`
    : null;
  const nextHref = hasNextPage
    ? `/products?page=${currentPage + 1}${initialKeyword ? `&q=${encodeURIComponent(initialKeyword)}` : ""}`
    : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-cream to-amber-50/25">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sage/90">Shop</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-umber sm:text-4xl">Products</h1>
          <p className="mt-3 text-base leading-relaxed text-umber/70">
            Everything you need for a happy, healthy pet - curated for quality and care.
          </p>
        </header>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              ...itemListSchema,
              url: canonicalUrl,
            }),
          }}
        />

        <div className="mt-12">
          <SearchSection allProducts={products} initialKeyword={initialKeyword} />
          <div className="mt-8 flex items-center justify-center gap-3">
            {prevHref ? (
              <Link
                href={prevHref}
                className="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-umber transition hover:bg-cream"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-amber-100 bg-cream px-4 py-2 text-sm text-umber/45">Previous</span>
            )}
            <span className="text-sm font-medium text-umber/70">Page {currentPage}</span>
            {nextHref ? (
              <Link
                href={nextHref}
                className="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-umber transition hover:bg-cream"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-amber-100 bg-cream px-4 py-2 text-sm text-umber/45">Next</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
