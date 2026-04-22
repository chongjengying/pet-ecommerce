import { supabase } from "@/lib/supabase";
import type { CatalogProduct, CatalogProductStatus } from "@/types/catalog";

type CatalogProductRow = Record<string, unknown>;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asMaybeText(value: unknown): string | null {
  const text = asText(value);
  return text ? text : null;
}

function normalizeStatus(value: unknown): CatalogProductStatus {
  const raw = asText(value).toLowerCase();
  if (raw === "draft" || raw === "active" || raw === "archived") return raw;
  return "draft";
}

function normalizeCatalogProduct(row: CatalogProductRow): CatalogProduct | null {
  const id = asText(row.id);
  const name = asText(row.name);
  const slug = asText(row.slug);
  const description = typeof row.description === "string" ? row.description : "";
  const categoryId = asText(row.category_id);
  const createdAt = asText(row.created_at);
  const updatedAt = asText(row.updated_at);

  if (!id || !name || !slug || !categoryId || !createdAt || !updatedAt) return null;

  return {
    id,
    name,
    slug,
    description,
    short_description: asMaybeText(row.short_description),
    category_id: categoryId,
    category_name: null,
    brand_id: asMaybeText(row.brand_id),
    brand_name: null,
    status: normalizeStatus(row.status),
    featured: Boolean(row.featured),
    thumbnail_url: asMaybeText(row.thumbnail_url),
    seo_title: asMaybeText(row.seo_title),
    seo_description: asMaybeText(row.seo_description),
    created_by: asMaybeText(row.created_by),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

async function fetchNameLookup(table: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.from(table).select("id,name").in("id", ids);
  if (error || !Array.isArray(data)) return new Map<string, string>();

  const map = new Map<string, string>();
  for (const row of data) {
    const id = asText((row as Record<string, unknown>).id);
    const name = asText((row as Record<string, unknown>).name);
    if (!id || !name) continue;
    map.set(id, name);
  }
  return map;
}

function applyLookups(products: CatalogProduct[], categoryById: Map<string, string>, brandById: Map<string, string>) {
  return products.map((product) => ({
    ...product,
    category_name: categoryById.get(product.category_id) ?? null,
    brand_name: product.brand_id ? (brandById.get(product.brand_id) ?? null) : null,
  }));
}

export async function getCatalogProducts(options?: {
  status?: CatalogProductStatus;
  search?: string;
  featuredOnly?: boolean;
}): Promise<CatalogProduct[]> {
  const status = options?.status ?? "active";
  const search = asText(options?.search ?? "");

  let query = supabase
    .from("catalog_products")
    .select(
      "id,name,slug,description,short_description,category_id,brand_id,status,featured,thumbnail_url,seo_title,seo_description,created_by,created_at,updated_at"
    )
    .eq("status", status)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.featuredOnly) {
    query = query.eq("featured", true);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const products = (Array.isArray(data) ? data : [])
    .map((row) => normalizeCatalogProduct(row as CatalogProductRow))
    .filter((row): row is CatalogProduct => row != null);

  const categoryIds = Array.from(new Set(products.map((p) => p.category_id)));
  const brandIds = Array.from(new Set(products.map((p) => p.brand_id).filter((id): id is string => Boolean(id))));

  const [categoryById, brandById] = await Promise.all([
    fetchNameLookup("categories", categoryIds),
    fetchNameLookup("brands", brandIds),
  ]);

  return applyLookups(products, categoryById, brandById);
}

export async function getCatalogProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const cleanSlug = asText(slug);
  if (!cleanSlug) return null;

  const { data, error } = await supabase
    .from("catalog_products")
    .select(
      "id,name,slug,description,short_description,category_id,brand_id,status,featured,thumbnail_url,seo_title,seo_description,created_by,created_at,updated_at"
    )
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const product = normalizeCatalogProduct(data as CatalogProductRow);
  if (!product) return null;

  const [categoryById, brandById] = await Promise.all([
    fetchNameLookup("categories", [product.category_id]),
    product.brand_id ? fetchNameLookup("brands", [product.brand_id]) : Promise.resolve(new Map<string, string>()),
  ]);

  return applyLookups([product], categoryById, brandById)[0] ?? null;
}
