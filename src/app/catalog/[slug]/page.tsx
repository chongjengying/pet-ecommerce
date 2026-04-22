import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogProductBySlug } from "@/services/catalogProductService";

type CatalogDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function imageFallback(seed: string): string {
  return `https://picsum.photos/1200/1200?random=${encodeURIComponent(seed)}`;
}

export default async function CatalogDetailPage({ params }: CatalogDetailPageProps) {
  const { slug } = await params;
  const product = await getCatalogProductBySlug(slug).catch(() => null);
  if (!product || product.status !== "active") return notFound();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-white to-amber-50/25">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <Link href="/catalog" className="text-sm font-semibold text-sage hover:text-umber">
          Back to catalog
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/30 shadow-sm">
            <Image
              src={product.thumbnail_url || imageFallback(product.id)}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>

          <article>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sage/90">
              {product.category_name || "Uncategorized"}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-umber sm:text-4xl">{product.name}</h1>
            {product.brand_name ? (
              <p className="mt-2 text-sm text-umber/70">
                Brand: <span className="font-medium text-umber">{product.brand_name}</span>
              </p>
            ) : null}
            <p className="mt-4 text-base leading-relaxed text-umber/80">
              {product.short_description || "No short description provided."}
            </p>
            <div className="mt-6 rounded-2xl border border-amber-200/80 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-umber/70">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-umber/80">
                {product.description || "No description provided."}
              </p>
            </div>

            <dl className="mt-6 grid gap-2 text-sm text-umber/70">
              <div>
                <dt className="inline font-semibold text-umber">Slug:</dt> <dd className="inline">{product.slug}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-umber">Status:</dt> <dd className="inline">{product.status}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-umber">Featured:</dt>{" "}
                <dd className="inline">{product.featured ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-umber">Updated:</dt> <dd className="inline">{new Date(product.updated_at).toLocaleString()}</dd>
              </div>
            </dl>
          </article>
        </div>
      </div>
    </div>
  );
}
