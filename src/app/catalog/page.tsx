import Image from "next/image";
import Link from "next/link";
import { getCatalogProducts } from "@/services/catalogProductService";

export const metadata = {
  title: "Catalog | PAWLUXE",
  description: "Browse active catalog products.",
};

function imageFallback(seed: string): string {
  return `https://picsum.photos/800/800?random=${encodeURIComponent(seed)}`;
}

export default async function CatalogPage() {
  const products = await getCatalogProducts({ status: "active" }).catch(() => []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-white to-amber-50/25">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sage/90">Catalog</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-umber sm:text-4xl">Product Catalog</h1>
          <p className="mt-3 text-base leading-relaxed text-umber/70">
            Active products from your new Supabase catalog table.
          </p>
        </header>

        {products.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-amber-200/80 bg-white p-8 text-center shadow-sm">
            <p className="text-base font-medium text-umber">No active catalog products yet.</p>
            <p className="mt-2 text-sm text-umber/65">Create rows in `catalog_products` and set `status = active`.</p>
          </div>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/catalog/${encodeURIComponent(product.slug)}`}
                  className="group block overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-amber-50/30">
                    <Image
                      src={product.thumbnail_url || imageFallback(product.id)}
                      alt={product.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    {product.featured ? (
                      <span className="absolute left-3 top-3 rounded-full bg-terracotta px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Featured
                      </span>
                    ) : null}
                  </div>
                  <div className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sage/90">
                      {product.category_name || "Uncategorized"}
                    </p>
                    <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-umber">{product.name}</h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-umber/70">
                      {product.short_description || product.description || "No description yet."}
                    </p>
                    <p className="mt-4 text-sm font-medium text-sage">View details</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
