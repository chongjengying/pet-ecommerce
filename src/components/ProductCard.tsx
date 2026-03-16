"use client";

import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";

interface ProductCardProps {
  product: Product;
}

function getStock(product: Product): number | undefined {
  if (product.stock == null) return undefined;
  const n = Number(product.stock);
  return Number.isNaN(n) ? undefined : n;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, items } = useCart();
  const imageUrl =
    product.image ?? product.image_url ?? `https://picsum.photos/400/400?random=${product.id}`;
  const baseStock = getStock(product);
  const cartQty = items.find((i) => String(i.id) === String(product.id))?.quantity ?? 0;
  const stock = baseStock !== undefined ? Math.max(0, baseStock - cartQty) : undefined;
  const outOfStock = stock !== undefined && stock <= 0;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-amber-200/60 bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/products/${product.id}`} className="block flex-1">
        <div className="relative aspect-square w-full bg-amber-50">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
        <div className="flex flex-1 flex-col p-4">
          {product.category && (
            <span className="text-xs font-medium uppercase tracking-wider text-sage">
              {product.category}
            </span>
          )}
          <h2 className="mt-1 text-lg font-semibold text-umber">{product.name}</h2>
          <p className="mt-2 line-clamp-2 text-sm text-umber/70">
            {product.description ?? ""}
          </p>
          <p className="mt-auto pt-3 text-lg font-bold text-terracotta">
            RM{Number(product.price).toFixed(2)}
          </p>
          {stock !== undefined && (
            <p className="mt-1 text-sm text-umber/70">
              {outOfStock ? (
                <span className="font-medium text-red-600">Out of stock</span>
              ) : stock <= 5 ? (
                <span>Only {stock} left</span>
              ) : (
                <span className="text-sage">{stock} in stock</span>
              )}
            </p>
          )}
        </div>
      </Link>
      <div className="border-t border-amber-100 p-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (!outOfStock) addToCart({ ...product, image: imageUrl, category: product.category ?? "" });
          }}
          disabled={outOfStock}
          className="w-full rounded-xl bg-terracotta py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-terracotta"
        >
          {outOfStock ? "Out of stock" : "Add to cart"}
        </button>
      </div>
    </article>
  );
}
