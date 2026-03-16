import { getProducts } from "@/services/productService";
import SearchSection from "@/components/SearchSection";

export const metadata = {
  title: "Products – Paw & Co",
  description: "Shop pet food, toys, bedding, and more.",
};

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-umber sm:text-4xl">
          Products
        </h1>
        <p className="mt-2 text-umber/70">
          Everything you need for a happy, healthy pet.
        </p>
        <div className="mt-6">
          <SearchSection allProducts={products} />
        </div>
      </div>
    </div>
  );
}
