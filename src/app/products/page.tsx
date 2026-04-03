import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/services/productService";
import type { Product } from "@/types";

export const metadata = {
  title: "Products – Paw & Co",
  description: "Shop pet food, toys, bedding, and more.",
};

/** Always fetch fresh product list (including stock) so post-checkout UI reflects DB. */
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
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
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
