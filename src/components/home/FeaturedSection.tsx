import Link from "next/link";
import type { Product } from "@/types";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/home/SectionHeader";

export default function FeaturedSection({ products }: { products: Product[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:pb-14">
      <SectionHeader
        eyebrow="Best Sellers"
        title="Essentials you can trust."
        subtitle="Clean picks for everyday care—easy to add, easy to reorder."
        actionHref="/products"
        actionLabel="Shop all products"
      />

      {products.length > 0 ? (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-umber/65">No products available right now.</p>
      )}

      <div className="mt-10 flex items-center justify-between rounded-3xl border border-amber-200/70 bg-white/70 px-6 py-5 shadow-sm backdrop-blur-xl">
        <p className="text-sm font-semibold text-umber">Looking for something specific?</p>
        <Link
          href="/products"
          className="rounded-full bg-umber px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-umber/90"
        >
          Explore the shop
        </Link>
      </div>
    </section>
  );
}

