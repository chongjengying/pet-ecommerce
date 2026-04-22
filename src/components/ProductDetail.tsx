"use client";

import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useEffect, useMemo, useState } from "react";
import { resolveProductImageUrl } from "@/lib/productImage";
import ProductCard from "@/components/ProductCard";

interface ProductDetailProps {
  product: Product;
  relatedProducts: Product[];
}

function toNonEmptyText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toSafeImageSrc(value: string | null | undefined, productId: string | number): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
    return raw;
  }
  return `https://picsum.photos/400/400?random=${productId}`;
}

function getStock(product: Product): number | undefined {
  if (product.stock == null) return undefined;
  const n = Number(product.stock);
  return Number.isNaN(n) ? undefined : n;
}

export default function ProductDetail({ product, relatedProducts }: ProductDetailProps) {
  const { addToCart, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [related, setRelated] = useState<Product[]>(relatedProducts);
  const safeId = toNonEmptyText(product?.id, "unknown-product");
  const safeName = toNonEmptyText(product?.name, "Product");
  const safePrice = Math.max(0, toFiniteNumber(product?.price, 0));
  const safeCategory = toNonEmptyText(product?.category, "Products");
  const safeBrand = toNonEmptyText(product?.brand, "");
  const safeDescription = toNonEmptyText(product?.description, "");
  const safeColor = toNonEmptyText(product?.color, "");
  const safeDeliveryLabel = toNonEmptyText(product?.delivery_badge_text, "RM0 Delivery");
  const safeProduct: Product = useMemo(
    () => ({
      ...product,
      id: safeId,
      name: safeName,
      price: safePrice,
      category: safeCategory,
      brand: safeBrand || null,
      description: safeDescription || null,
      color: safeColor || null,
      delivery_badge_text: safeDeliveryLabel,
    }),
    [product, safeCategory, safeDeliveryLabel, safeDescription, safeId, safeName, safePrice, safeBrand, safeColor]
  );

  const gallery = useMemo(() => {
    const g = safeProduct.gallery_images;
    if (Array.isArray(g) && g.length > 0) {
      return g.map((url) => toSafeImageSrc(url, safeId));
    }
    return [toSafeImageSrc(resolveProductImageUrl(safeProduct), safeId)];
  }, [safeId, safeProduct]);

  const [activeIndex, setActiveIndex] = useState(0);
  const mainImageUrl =
    gallery[Math.min(activeIndex, gallery.length - 1)] ??
    toSafeImageSrc(resolveProductImageUrl(safeProduct), safeId);
  const displayRelated = relatedProducts.length > 0 ? relatedProducts : related;

  useEffect(() => {
    if (relatedProducts.length > 0) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/products/${encodeURIComponent(String(safeId))}/related`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json().catch(() => ({}))) as { products?: Product[] };
        if (!active || !Array.isArray(data.products)) return;
        setRelated(data.products);
      } catch {
        // keep UI usable even when related products fail to load
      }
    })();
    return () => {
      active = false;
    };
  }, [relatedProducts, safeId]);

  const stock = getStock(safeProduct);
  const inCartQty = items.find((i) => String(i.id) === String(safeId))?.quantity ?? 0;
  const availableStock = stock !== undefined ? Math.max(0, stock - inCartQty) : undefined;
  const outOfStock = availableStock !== undefined && availableStock <= 0;
  const maxQty = availableStock !== undefined ? Math.max(0, availableStock) : undefined;
  const effectiveQty = maxQty !== undefined ? Math.min(quantity, maxQty) : quantity;

  const compareAt = toFiniteNumber(safeProduct.compare_at_price, 0);
  const showCompare =
    compareAt > safePrice;
  const discountPct =
    showCompare
      ? Math.max(0, Math.round((1 - safePrice / compareAt) * 100))
      : 0;

  const deliveryLabel = safeDeliveryLabel;

  /** Matches admin “Size” / `size_label` and DB `size` / `item_size` (see normalizeProduct). */
  const sizeDisplay = useMemo(() => {
    const s = (safeProduct.size_label ?? safeProduct.size)?.trim();
    return s && s.length > 0 ? s : "";
  }, [safeProduct.size_label, safeProduct.size]);

  const handleAddToCart = async () => {
    if (outOfStock || effectiveQty <= 0) return;
    const ok = await addToCart(
        {
        ...safeProduct,
        image: resolveProductImageUrl(safeProduct),
        category: safeCategory,
      },
      effectiveQty
    );
    if (!ok) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const categoryLabel = safeCategory;
  const brandLabel = safeBrand || undefined;

  const expandSections = [
    { key: "benefit", title: "Benefit", value: safeProduct.benefit },
    { key: "ingredients", title: "Ingredients", value: safeProduct.ingredients },
    { key: "feeding", title: "Feeding Instructions", value: safeProduct.feeding_instructions },
  ] as const;

  const sharePage = () => {
    if (typeof window === "undefined") return;
    return encodeURIComponent(window.location.href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-white to-amber-50/20 text-umber">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        {/* Breadcrumbs */}
        <nav className="text-sm text-umber/70" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link href="/" className="transition hover:text-sage hover:underline">
                Home
              </Link>
            </li>
            <li className="text-umber/35" aria-hidden="true">
              /
            </li>
            <li>
              <Link href="/products" className="transition hover:text-sage hover:underline">
                {categoryLabel}
              </Link>
            </li>
            <li className="text-umber/35" aria-hidden="true">
              /
            </li>
            <li className="line-clamp-2 font-medium text-umber">{safeName}</li>
          </ol>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Left: gallery */}
          <div>
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-b from-amber-50/50 to-cream shadow-sm">
              <div className="relative aspect-square w-full">
                <Image
                  src={mainImageUrl}
                  alt={safeName}
                  fill
                  className="object-contain p-4"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
              <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-umber/90 px-3 py-1.5 text-xs font-semibold text-cream shadow-md backdrop-blur-sm">
                <span aria-hidden="true">🚚</span>
                {deliveryLabel}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-umber/50">Tap image to expand</p>
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-white px-3 py-1.5 text-xs font-medium text-umber shadow-sm transition hover:border-sage/40 hover:bg-cream"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                  />
                </svg>
                Click to expand
              </button>
            </div>

            {gallery.length > 1 ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {gallery.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-cream transition ${
                      i === activeIndex ? "border-sage ring-2 ring-sage/25" : "border-amber-200/80 hover:border-amber-300"
                    }`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Right: info */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-umber sm:text-3xl lg:text-4xl">
              {safeName}
            </h1>
            {brandLabel ? (
              <p className="mt-2 text-sm text-sage">
                by <span className="font-medium">{brandLabel}</span>
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-end gap-3">
              {showCompare && discountPct > 0 ? (
                <span className="rounded-full bg-terracotta px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                  Save {discountPct}%
                </span>
              ) : null}
              <div className="flex flex-wrap items-baseline gap-3">
                {showCompare && compareAt != null ? (
                  <span className="text-lg text-umber/45 line-through tabular-nums">RM{compareAt.toFixed(2)}</span>
                ) : null}
                <p className="tabular-nums">
                  <span className="text-lg font-medium text-umber/70">RM</span>{" "}
                  <span className="text-3xl font-semibold tracking-tight text-terracotta sm:text-4xl">
                    {safePrice.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>

            {availableStock !== undefined && (
              <p className="mt-3 text-sm text-umber/75">
                {outOfStock ? (
                  <span className="font-medium text-red-600">Out of stock</span>
                ) : availableStock <= 5 ? (
                  <span className="font-medium text-terracotta">Only {availableStock} left in stock</span>
                ) : (
                  <span className="text-sage">In stock ({availableStock})</span>
                )}
              </p>
            )}

            <div className="mt-8 rounded-2xl border border-amber-200/80 bg-gradient-to-b from-cream/60 to-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-umber/50">Quantity</p>
              <div className="mt-3 inline-flex items-center overflow-hidden rounded-xl border border-amber-200/90 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center text-lg text-umber transition hover:bg-cream"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="min-w-[3rem] text-center text-sm font-semibold tabular-nums text-umber">{effectiveQty}</span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => (maxQty !== undefined ? Math.min(q + 1, maxQty) : q + 1))
                  }
                  disabled={maxQty !== undefined && quantity >= maxQty}
                  className="flex h-11 w-11 items-center justify-center text-lg text-umber transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleAddToCart()}
                disabled={outOfStock || (maxQty !== undefined && quantity > maxQty)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-terracotta/92 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:cursor-not-allowed disabled:bg-umber/35 disabled:text-white/85"
              >
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                {outOfStock ? "Out of stock" : added ? "Added to cart" : "Add to cart"}
              </button>
              {added ? (
                <p className="mt-3 text-center text-xs text-sage">You can change quantities in your cart.</p>
              ) : null}

              <Link
                href="/cart"
                className="mt-4 block text-center text-sm font-medium text-sage transition hover:text-umber hover:underline"
              >
                View cart →
              </Link>
            </div>

            {/* Specs — inline "Label: value" like reference (bold label, regular value) */}
            <div className="mt-10 space-y-2.5 border-t border-amber-200/80 pt-8 text-sm leading-relaxed text-umber">
              <p>
                <span className="font-bold">Item:</span>{" "}
                <span className="font-normal">{safeName}</span>
              </p>
              <p>
                <span className="font-bold">Size:</span>{" "}
                <span className="font-normal">{sizeDisplay || "—"}</span>
              </p>
              <p>
                <span className="font-bold">Color:</span>{" "}
                <span className="font-normal">{safeColor || "—"}</span>
              </p>
              <p>
                <span className="font-bold">Quantity:</span>{" "}
                <span className="font-normal">
                  {sizeDisplay ? `${sizeDisplay} x ${effectiveQty}` : `1 x ${effectiveQty}`}
                </span>
              </p>
            </div>

            {safeDescription ? (
              <div className="mt-8 border-t border-amber-200/80 pt-8">
                <h2 className="text-sm font-semibold text-umber">Description</h2>
                <p className="mt-2 text-sm leading-relaxed text-umber/75">{safeDescription}</p>
              </div>
            ) : null}

            <div className="mt-8 border-t border-amber-200/80 pt-2">
              <h2 className="text-sm font-semibold text-umber">Product details</h2>
              {expandSections.map(({ key, title, value }) => {
                const body = value != null && String(value).trim() ? String(value).trim() : null;
                return (
                  <details
                    key={key}
                    className="group border-b border-amber-200/70 py-3 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-umber hover:text-sage">
                      {title}
                      <svg
                        className="h-5 w-5 shrink-0 text-umber/40 transition group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="mt-3 text-sm leading-relaxed text-umber/75">
                      {body ? (
                        <p className="whitespace-pre-wrap">{body}</p>
                      ) : (
                        <p className="text-umber/45 italic">No information added yet.</p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>

            {/* Share */}
            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-amber-200/80 pt-8">
              <span className="text-sm font-medium text-umber/80">Share this:</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { name: "Facebook", color: "bg-[#1877F2]", href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
                    { name: "X", color: "bg-neutral-900", href: (u: string) => `https://twitter.com/intent/tweet?url=${u}` },
                    { name: "in", color: "bg-[#0A66C2]", href: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
                    { name: "P", color: "bg-[#E60023]", href: (u: string) => `https://pinterest.com/pin/create/button/?url=${u}` },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => {
                      const u = sharePage();
                      if (!u) return;
                      window.open(s.href(u), "_blank", "noopener,noreferrer");
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${s.color} hover:opacity-90`}
                    aria-label={`Share on ${s.name}`}
                  >
                    {s.name === "in" ? "in" : s.name === "P" ? "P" : s.name[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* You may also like */}
        {displayRelated.length > 0 ? (
          <section className="mt-16 border-t border-amber-200/80 pt-12">
            <h2 className="text-center text-xl font-bold text-umber sm:text-2xl">You may also like</h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {displayRelated.map((p, idx) => (
                <li key={String(p?.id ?? `related-${idx}`)}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* Zoom modal */}
      {zoomOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Product image"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-umber shadow-sm"
            onClick={() => setZoomOpen(false)}
          >
            Close
          </button>
          <div className="relative h-[min(85vh,800px)] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image src={mainImageUrl} alt={safeName} fill className="object-contain" sizes="100vw" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
