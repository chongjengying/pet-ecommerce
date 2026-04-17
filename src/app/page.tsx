import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/services/productService";
import type { Product } from "@/types";

const categoryCards = [
  {
    name: "Pet Food",
    description: "Nutritious daily meals and treats for every life stage.",
    href: "/products?q=food",
  },
  {
    name: "Toys",
    description: "Playtime favorites that keep pets active and happy.",
    href: "/products?q=toys",
  },
  {
    name: "Grooming",
    description: "Shampoo, brushes, and care tools for fresh coats.",
    href: "/grooming",
  },
  {
    name: "Accessories",
    description: "Leashes, collars, carriers, and daily essentials.",
    href: "/products?q=accessories",
  },
] as const;

export default async function Home() {
  const products: Product[] = await getProducts();
  const bestSellers = products.slice(0, 4);

  return (
    <div className="bg-cream">
      <section className="border-b border-amber-200/60 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(120,146,111,0.18),transparent_30%),linear-gradient(135deg,rgba(255,250,241,1),rgba(247,238,224,0.96),rgba(242,236,226,0.98))] px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sage/90">Homepage Hero</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-umber sm:text-5xl md:text-6xl">
            Everything Your Pet Needs in One Place
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-umber/75 sm:text-lg">
            Shop trusted pet products, discover top picks, and enjoy a smoother pet-care routine in one store.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-terracotta/90"
            >
              Shop now
            </Link>
            <Link
              href="/grooming"
              className="rounded-full border border-umber/20 bg-white px-6 py-3 text-sm font-semibold text-umber transition hover:bg-amber-50"
            >
              Book grooming
            </Link>
            <Link
              href="/admin/login"
              className="rounded-full border border-sage/40 bg-sage/10 px-6 py-3 text-sm font-semibold text-sage transition hover:bg-sage/20"
            >
              Temporary Admin Access
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-umber sm:text-3xl">Categories</h2>
          <Link href="/products" className="text-sm font-semibold text-sage hover:text-umber">
            View all products
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categoryCards.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sage/40 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-umber">{category.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-umber/70">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-umber sm:text-3xl">Best Sellers</h2>
        {bestSellers.length > 0 ? (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {bestSellers.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-umber/65">No products available right now.</p>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="rounded-3xl border border-amber-200/70 bg-[linear-gradient(120deg,rgba(193,127,89,0.16),rgba(250,248,245,1))] p-7 shadow-sm sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-umber/55">Promo Banner</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-umber sm:text-3xl">Limited-Time Discount</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-umber/75 sm:text-base">
            Save up to 30% on selected pet essentials this week only.
          </p>
          <Link
            href="/products"
            className="mt-5 inline-flex rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta/90"
          >
            Claim offer
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-umber sm:text-3xl">Why Choose Us</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-umber">High Quality Products</h3>
            <p className="mt-2 text-sm text-umber/70">Carefully curated items from trusted suppliers and brands.</p>
          </article>
          <article className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-umber">Secure Payment</h3>
            <p className="mt-2 text-sm text-umber/70">Safe checkout with reliable payment handling and protection.</p>
          </article>
          <article className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-umber">Fast Delivery</h3>
            <p className="mt-2 text-sm text-umber/70">Quick dispatch to get pet essentials to your door faster.</p>
          </article>
          <article className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-umber">Customer Support</h3>
            <p className="mt-2 text-sm text-umber/70">Friendly team support for product help and order updates.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
