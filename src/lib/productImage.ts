import { supabase } from "@/lib/supabase";
import type { Product } from "@/types";

/** Resolve a storage path or public URL from DB to a full browser URL. */
export function toPublicSupabaseUrl(raw: string): string {
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

  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
  return data?.publicUrl || value;
}

/** Resolved URL for display and cart (matches ProductCard behavior). */
export function resolveProductImageUrl(product: Product): string {
  const supabaseUrl =
    typeof product.image_url === "string" ? toPublicSupabaseUrl(product.image_url) : "";
  if (supabaseUrl) return supabaseUrl;

  const fallbackImage = typeof product.image === "string" ? toPublicSupabaseUrl(product.image) : "";
  if (fallbackImage) return fallbackImage;

  return `https://picsum.photos/400/400?random=${product.id}`;
}
