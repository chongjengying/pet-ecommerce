"use client";

import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";

interface ProductCardProps {
  product: Product;
}

function getStock(product: Product): number | undefined {
  if (product.stock == null) return undefined;
  const n = Number(product.stock);
  return Number.isNaN(n) ? undefined : n;
}

function toPublicSupabaseUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const bucket = (process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_BUCKET ?? "pet_commerce").trim();
  if (!bucket) return value;

  if (value.startsWith("/storage/v1/object/public/")) {
    return projectUrl ? `${projectUrl}${value}` : value;
  }

  let normalizedPath = value.replace(/^\/+/, "");
  const bucketPrefix = `${bucket}/`;
  if (normalizedPath.startsWith(bucketPrefix)) {
    normalizedPath = normalizedPath.slice(bucketPrefix.length);
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(normalizedPath);
  return data?.publicUrl || value;
}

function pickProductImageUrl(product: Product): string {
  const supabaseUrl = typeof product.image_url === "string"
    ? toPublicSupabaseUrl(product.image_url)
    : "";
  if (supabaseUrl) return supabaseUrl;

  const fallbackImage = typeof product.image === "string"
    ? toPublicSupabaseUrl(product.image)
    : "";
  if (fallbackImage) return fallbackImage;

  return `https://picsum.photos/400/400?random=${product.id}`;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, items } = useCart();
  const imageUrl = pickProductImageUrl(product);
  const stock = getStock(product);
  const inCartQty = items.find((i) => String(i.id) === String(product.id))?.quantity ?? 0;
  const availableStock = stock !== undefined ? Math.max(0, stock - inCartQty) : undefined;
  const outOfStock = availableStock !== undefined && availableStock <= 0;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-amber-200/60 bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/products/${product.id}`} className="block flex-1">
        <div className="relative aspect-square w-full bg-amber-50">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            unoptimized
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
          {availableStock !== undefined && (
            <p className="mt-1 text-sm text-umber/70">
              {outOfStock ? (
                <span className="font-medium text-red-600">Out of stock</span>
              ) : availableStock <= 5 ? (
                <span>Only {availableStock} left</span>
              ) : (
                <span className="text-sage">{availableStock} in stock</span>
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
