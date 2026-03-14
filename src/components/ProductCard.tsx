"use client";

import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const imageUrl =
    product.image ?? product.image_url ?? `https://picsum.photos/400/400?random=${product.id}`;

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
            ${Number(product.price).toFixed(2)}
          </p>
        </div>
      </Link>
      <div className="border-t border-amber-100 p-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            addToCart({ ...product, image: imageUrl, category: product.category ?? "" });
          }}
          className="w-full rounded-xl bg-terracotta py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta/90"
        >
          Add to cart
        </button>
      </div>
    </article>
  );
}
