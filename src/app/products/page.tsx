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
    <div className="bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-umber sm:text-4xl">
          Products
        </h1>
        <p className="mt-2 text-umber/70">
          Everything you need for a happy, healthy pet.
        </p>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
