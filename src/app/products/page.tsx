import SearchSection from "@/components/SearchSection";
import { getProducts } from "@/services/productService";
import type { Product } from "@/types";

export const metadata = {
  title: "Products – Paw & Co",
  description: "Shop pet food, toys, bedding, and more.",
};

/** Always fetch fresh product list (including stock) so post-checkout UI reflects DB. */
export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams?:
    | {
        q?: string;
      }
    | Promise<{
        q?: string;
      }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await Promise.resolve(searchParams ?? {});
  const initialKeyword = String(params.q ?? "").trim();
  const products: Product[] = await getProducts();
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-cream to-amber-50/25">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sage/90">Shop</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-umber sm:text-4xl">Products</h1>
          <p className="mt-3 text-base leading-relaxed text-umber/70">
            Everything you need for a happy, healthy pet — curated for quality and care.
          </p>
        </header>
        <div className="mt-12">
          <SearchSection allProducts={products} initialKeyword={initialKeyword} />
        </div>
      </div>
    </div>
  );
}
