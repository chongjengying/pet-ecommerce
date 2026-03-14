import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabaseClient";
import { Product } from "@/types";

export const metadata = {
  title: "Products – Paw & Co",
  description: "Shop pet food, toys, bedding, and more.",
};

// Always fetch fresh from Supabase so new products show right away
export const dynamic = "force-dynamic";

async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*");

  if (error) {
    console.error("Supabase products error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: row.name ?? "",
    description: row.description ?? null,
    price: Number(row.price),
    image_url: row.image_url ?? undefined,
    category: row.category ?? undefined,
  }));
}

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
        {products.length > 0 && (
          <p className="mt-1 text-sm text-sage" data-testid="products-from-db">
            Showing {products.length} product{products.length !== 1 ? "s" : ""} from database
            {products.length <= 3 && (
              <span className="ml-1 text-umber/60">
                (IDs: {products.map((p) => p.id).join(", ")})
              </span>
            )}
          </p>
        )}
        {products.length === 0 ? (
          <p className="mt-10 text-umber/70">No products yet. Add some in Supabase.</p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
