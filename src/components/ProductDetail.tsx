"use client";

import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useState } from "react";

interface ProductDetailProps {
  product: Product;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm font-medium text-umber/70 hover:text-umber"
        >
          ← Back to products
        </Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-amber-50">
            <Image
              src={`https://picsum.photos/600/600?random=${product.id}`}
              alt={product.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div>
            {product.category && (
              <span className="text-xs font-medium uppercase tracking-wider text-sage">
                {product.category}
              </span>
            )}
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-umber sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-4 text-2xl font-bold text-terracotta">
              ${Number(product.price ?? 0).toFixed(2)}
            </p>
            {product.description != null && (
              <p className="mt-6 text-umber/80">{product.description}</p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-xl border border-amber-200 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center text-umber hover:bg-amber-50"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-11 w-11 items-center justify-center text-umber hover:bg-amber-50"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="rounded-xl bg-terracotta px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-terracotta/90 disabled:opacity-70"
              >
                {added ? "Added to cart ✓" : "Add to cart"}
              </button>
            </div>
            <Link
              href="/cart"
              className="mt-4 inline-block text-sm font-medium text-terracotta hover:underline"
            >
              View cart →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
