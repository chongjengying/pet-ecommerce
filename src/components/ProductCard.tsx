"use client";

import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { resolveProductImageUrl } from "@/lib/productImage";

function getStock(product: Product): number | undefined {
  if (product.stock == null) return undefined;
  const n = Number(product.stock);
  return Number.isNaN(n) ? undefined : n;
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart, items } = useCart();
  const imageUrl = resolveProductImageUrl(product);
  const warehouseStock = getStock(product);
  const inCartQty = items.find((i) => String(i.id) === String(product.id))?.quantity ?? 0;
  const availableToBuy =
    warehouseStock !== undefined ? Math.max(0, warehouseStock - inCartQty) : undefined;

  const outOfStock =
    (warehouseStock !== undefined && warehouseStock <= 0) ||
    (availableToBuy !== undefined && availableToBuy <= 0);

  const price = Number(product.price ?? 0);
  const lowStock =
    !outOfStock && availableToBuy !== undefined && availableToBuy > 0 && availableToBuy <= 5;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-[0_2px_12px_rgba(44,36,32,0.04)] ring-1 ring-black/[0.03] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(44,36,32,0.09)] hover:ring-amber-200/60">
      <Link
        href={`/products/${product.id}`}
        className="flex flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-sage/50 focus-visible:ring-offset-2"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-amber-50/90 to-cream">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            unoptimized
            className="object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {inCartQty > 0 ? (
            <span className="absolute left-3 top-3 rounded-full bg-umber/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cream shadow-sm backdrop-blur-sm">
              In cart · {inCartQty}
            </span>
          ) : null}
          {lowStock ? (
            <span className="absolute right-3 top-3 rounded-full bg-terracotta/95 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              Low stock
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {product.category ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage/90">{product.category}</p>
          ) : null}
          <h2 className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug text-umber transition group-hover:text-sage sm:text-[1.05rem]">
            {product.name}
          </h2>

          <div className="mt-4 flex items-end justify-between gap-3 border-t border-amber-100/80 pt-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-umber/45">Price</p>
              <p className="mt-0.5 tabular-nums">
                <span className="text-sm font-medium text-umber/70">RM</span>{" "}
                <span className="text-xl font-semibold tracking-tight text-terracotta">{price.toFixed(2)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-umber/45">Stock</p>
              <p className="mt-0.5 text-sm">
                {warehouseStock == null ? (
                  <span className="text-umber/45">—</span>
                ) : outOfStock ? (
                  <span className="font-medium text-red-600/90">Sold out</span>
                ) : availableToBuy !== undefined && availableToBuy <= 5 ? (
                  <span className="font-medium text-terracotta">{availableToBuy} left</span>
                ) : (
                  <span className="text-umber/75">In stock</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </Link>

      <div className="border-t border-amber-100/90 bg-gradient-to-b from-cream/40 to-white px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!outOfStock) addToCart({ ...product, image: imageUrl, category: product.category ?? "" });
          }}
          disabled={outOfStock}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-terracotta/92 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:cursor-not-allowed disabled:bg-umber/30 disabled:text-white/85 disabled:shadow-none"
        >
          <CartIcon className="h-4 w-4 shrink-0 opacity-95" />
          {outOfStock ? "Unavailable" : inCartQty > 0 ? "Add another" : "Add to cart"}
        </button>
      </div>
    </article>
  );
}
