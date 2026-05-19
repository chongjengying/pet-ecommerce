"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { resolveProductImageUrl } from "@/lib/productImage";

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart, items } = useCart();
  const [loading, setLoading] = useState(false);

  const imageUrl = resolveProductImageUrl(product);
  const price = Number(product.price ?? 0);
  const productPath = `/products/${encodeURIComponent(String(product.slug ?? product.id))}`;

  const inCartQty =
    items.find((i) => String(i.id) === String(product.id))?.quantity ?? 0;

  const handleAdd = async () => {
    if (loading) return;
    setLoading(true);
    await addToCart({ ...product, image: imageUrl });
    setLoading(false);
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">

      {/* IMAGE */}
      <Link href={productPath} className="block relative aspect-square overflow-hidden">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className="object-cover transition duration-500 group-hover:scale-110"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />

        {/* Add to cart (hover) */}
        <div className="absolute bottom-4 left-1/2 w-[85%] -translate-x-1/2 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAdd();
            }}
            className="w-full rounded-full bg-white py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-black hover:text-white"
          >
            {loading ? "Adding..." : "Add to cart"}
          </button>
        </div>
      </Link>

      {/* CONTENT */}
      <div className="p-4">
        <p className="text-xs text-black/40">{product.category}</p>

        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-black">
          {product.name}
        </h3>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-lg font-bold text-black">
            RM {price.toFixed(2)}
          </p>

          {inCartQty > 0 && (
            <span className="text-xs text-black/40">
              {inCartQty} in cart
            </span>
          )}
        </div>
      </div>
    </div>
  );
}