import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import { supabase } from "@/lib/supabaseClient";
import { Product } from "@/types";

// Always fetch from Supabase on request so product shows
export const dynamic = "force-dynamic";

function mapRowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: (row.name as string) ?? "",
    description: (row.description as string | null) ?? null,
    price: Number(row.price),
    image_url: (row.image_url as string) ?? undefined,
    category: (row.category as string) ?? undefined,
  };
}

async function getProductById(id: string) {
  // Table uses int8 id; use number when id is numeric so .eq() matches
  const idVal = /^\d+$/.test(id) ? Number(id) : id;
  return supabase.from("products").select("*").eq("id", idVal).maybeSingle();
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await getProductById(id);

  if (error) {
    console.error("Product fetch error:", error.message, "id:", id);
    notFound();
  }
  if (!data) notFound();
  const product = mapRowToProduct(data as Record<string, unknown>);
  return <ProductDetail product={product} />;
}
