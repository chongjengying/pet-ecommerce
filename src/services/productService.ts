import { createClient } from "@supabase/supabase-js"
import { resolveProductImageUrl, toPublicSupabaseUrl } from "@/lib/productImage"
import { supabase } from "@/lib/supabase"
import type { Product } from "@/types"

type ProductRow = Record<string, unknown> & { id?: string | number }
type ProductQueryOptions = {
  page?: number
  pageSize?: number
}
type SearchProductsOptions = ProductQueryOptions
export type ProductPageResult = {
  items: Product[]
  page: number
  pageSize: number
  hasNextPage: boolean
}

export type ProductLike = {
  id: string | number
  name: string
  description?: string
  price?: number
  images?: unknown[]
}

export function isRenderableProduct(product: unknown): product is ProductLike {
  if (!product || typeof product !== "object") return false
  const p = product as Record<string, unknown>
  return (
    (typeof p.id === "string" || typeof p.id === "number") &&
    typeof p.name === "string" &&
    p.name.trim().length > 0
  )
}

export function isValidProduct(product: Product | null | undefined): product is Product {
  if (!product) return false
  if (typeof product.id !== "string" || product.id.trim().length === 0) return false
  if (typeof product.name !== "string" || product.name.trim().length === 0) return false
  if (!Number.isFinite(product.price) || product.price < 0) return false
  if (product.stock != null && (!Number.isFinite(product.stock) || product.stock < 0)) return false
  if (product.gallery_images != null) {
    if (!Array.isArray(product.gallery_images)) return false
    if (!product.gallery_images.every((url) => typeof url === "string" && url.trim().length > 0)) {
      return false
    }
  }
  return true
}

const PRODUCT_LIST_COLUMNS = [
  "id",
  "slug",
  "name",
  "price",
  "thumbnail_url",
  "category_id",
  "stock",
  "brand",
  "size",
  "color",
  "status",
]
const DEFAULT_PRODUCT_PAGE_SIZE = 24

function parseMissingColumn(error: unknown): string | null {
  const message =
    typeof (error as { message?: unknown })?.message === "string"
      ? (error as { message: string }).message
      : ""
  const fromPostgrest = message.match(/Could not find the '([^']+)' column/i)?.[1]
  if (fromPostgrest) return fromPostgrest

  const fromPostgres = message.match(/column\s+([a-zA-Z0-9_."]+)\s+does not exist/i)?.[1]
  if (!fromPostgres) return null

  const normalized = fromPostgres.replace(/"/g, "")
  const parts = normalized.split(".")
  return parts[parts.length - 1] ?? null
}

function isMissingColumnError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? "").toLowerCase()
  if (code === "42703" || code === "pgrst204") return true
  const message =
    typeof (error as { message?: unknown })?.message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : ""
  return (
    message.includes("column") &&
    (message.includes("does not exist") || message.includes("could not find"))
  )
}

async function selectProductsWithFallback(
  buildQuery: (selectColumns: string) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<ProductRow[]> {
  const columns = [...PRODUCT_LIST_COLUMNS]
  let lastError: unknown = null

  for (let attempt = 0; attempt < PRODUCT_LIST_COLUMNS.length; attempt++) {
    const selectColumns = columns.join(",")
    console.log(selectColumns)
    const { data, error } = await buildQuery(selectColumns)
    if (!error) return (Array.isArray(data) ? data : []) as ProductRow[]

    lastError = error
    const missingColumn = parseMissingColumn(error)
    if (!isMissingColumnError(error) || !missingColumn) {
      throw error
    }
    const index = columns.indexOf(missingColumn)
    if (index < 0) {
      throw error
    }
    columns.splice(index, 1)
    if (columns.length === 0) {
      throw error
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[productService] Removed missing column from products select", {
        missingColumn,
        attempt: attempt + 1,
      })
    }
  }

  throw (lastError as Error) ?? new Error("Could not load products due to schema mismatch.")
}

/**
 * PDP text fields may be `text` or `jsonb` in Postgres; Supabase returns strings,
 * objects, or arrays. Strict `typeof === "string"` checks drop valid DB values.
 */
function coerceProductDetailText(...candidates: unknown[]): string | null {
  for (const value of candidates) {
    if (value == null) continue
    if (typeof value === "string") {
      const t = value.trim()
      if (t.length > 0) return t
      continue
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value)
    }
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join("\n")
        .trim()
      if (joined.length > 0) return joined
      continue
    }
    if (typeof value === "object") {
      const s = JSON.stringify(value)
      if (s && s !== "{}") return s
    }
  }
  return null
}

function toRecordLike(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === "string") {
    const raw = value.trim()
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

function getDetailField(details: unknown, keys: string[]): unknown {
  const record = toRecordLike(details)
  if (!record) return undefined
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return undefined
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "active", "enabled", "published"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive", "disabled", "draft", "archived"].includes(normalized)) return false;
  }
  return undefined;
}

function isProductVisible(row: ProductRow): boolean {
  const statusFlag = toOptionalBoolean(row?.status);
  if (statusFlag !== undefined) return statusFlag;
  return true;
}

type InventoryLogInput = {
  order_id?: string | null
  order_number?: string | null
  note?: string | null
}

function getServerWriteClient() {
  if (typeof window !== "undefined") return supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return supabase
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function insertInventoryLogSafely(payload: Record<string, unknown>, db = supabase) {
  const insertPayload: Record<string, unknown> = { ...payload }
  // Retry by removing unknown columns if local schema cache is stale.
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await db
      .from("inventory_logs")
      .insert(insertPayload)

    if (!error) return

    const message =
      typeof error.message === "string"
        ? error.message
        : (error as { message?: string }).message ?? JSON.stringify(error)
    const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i)
    const missingColumn = missingColumnMatch?.[1]

    if (!missingColumn || !(missingColumn in insertPayload)) {
      throw new Error(message)
    }

    delete insertPayload[missingColumn]
  }

  throw new Error("Could not insert inventory log due to schema mismatch.")
}

function chooseBestImageUrl(rows: Array<Record<string, unknown>>): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const normalized = rows
    .map((r) => ({
      image_url: typeof r.image_url === "string" ? r.image_url : null,
      is_main: Boolean(r.is_main),
      sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
    }))
    .filter((r) => typeof r.image_url === "string" && r.image_url.length > 0)

  if (normalized.length === 0) return null

  normalized.sort((a, b) => {
    // main image first
    if (a.is_main !== b.is_main) return a.is_main ? -1 : 1
    // lower sort_order first
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return 0
  })

  return normalized[0]?.image_url ?? null
}

async function attachProductImages(rows: ProductRow[]) {
  const debugImageSync = process.env.NODE_ENV !== "production"
  const list = Array.isArray(rows) ? rows : []
  const hasInlineImage = (row: ProductRow) => {
    const imageUrl = typeof row?.image_url === "string" ? row.image_url.trim() : ""
    if (imageUrl) return true
    const image = typeof row?.image === "string" ? row.image.trim() : ""
    return Boolean(image)
  }
  if (list.length > 0 && list.every((row) => hasInlineImage(row))) {
    return list
  }

  const ids = list
    .map((p) => p?.id)
    .filter((id): id is string | number => id != null && id !== "")
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id))))
    .map((id) => (/^\d+$/.test(id) ? Number(id) : id))

  if (uniqueIds.length === 0) return list

  // Fetch images from known table names and merge onto products as image_url.
  // Supabase defaults to the "public" schema.
  const imageTables = ["product_images"]
  let images: Array<Record<string, unknown>> = []
  let fetched = false

  for (const table of imageTables) {
    const { data, error } = await supabase
      .from(table)
      .select("product_id,image_url,is_main,sort_order")
      .in("product_id", uniqueIds as (string | number)[])

    if (!error && Array.isArray(data)) {
      if (debugImageSync) {
        console.log("[productService] image table fetch success", {
          table,
          requestedProductIds: uniqueIds.length,
          rows: data.length,
          sample: data.slice(0, 3).map((row) => ({
            product_id: row.product_id,
            image_url: row.image_url,
            is_main: row.is_main,
          })),
        })
      }
      images = data as Array<Record<string, unknown>>
      fetched = true
      break
    }

    const message = typeof error?.message === "string" ? error.message : ""
    if (debugImageSync) {
      console.warn("[productService] image table fetch failed", {
        table,
        error: message || "Unknown error",
      })
    }
    const missingRelation =
      message.includes("Could not find the table") ||
      message.includes("relation") ||
      message.includes("does not exist")
    if (!missingRelation) {
      // RLS or other query error: keep products list working without throwing.
      return list
    }
  }

  if (!fetched) return list

  const byProductId = new Map<string, Array<Record<string, unknown>>>()
  for (const row of images) {
    const pid = row.product_id
    const key = pid == null ? "" : String(pid)
    if (!key) continue
    const bucket = byProductId.get(key) ?? []
    bucket.push(row)
    byProductId.set(key, bucket)
  }

  const merged = list.map((p) => {
    const key = p?.id == null ? "" : String(p.id)
    const chosen = key ? chooseBestImageUrl(byProductId.get(key) ?? []) : null
    if (!chosen) return p
    return { ...p, image_url: chosen, image: chosen }
  })

  if (debugImageSync) {
    const withResolvedImageCount = merged.filter((p) => {
      const url = typeof p?.image_url === "string" ? p.image_url.trim() : ""
      return url.length > 0
    }).length
    console.log("[productService] image merge result", {
      totalProducts: merged.length,
      resolvedImageUrlProducts: withResolvedImageCount,
    })
  }

  return merged
}

async function attachCategoryNames(rows: ProductRow[]) {
  const list = Array.isArray(rows) ? rows : []
  const rowNeedsCategoryLookup = (row: ProductRow) => {
    const rawId = row?.category_id ?? row?.categoryid
    if (rawId == null || rawId === "") return false
    const id = String(rawId)
    const category = typeof row?.category === "string" ? row.category.trim() : ""
    return !category || category === id
  }

  if (list.length > 0 && list.every((row) => !rowNeedsCategoryLookup(row))) {
    return list
  }

  const categoryIds = list
    .filter((p) => rowNeedsCategoryLookup(p))
    .map((p) => p?.category_id ?? p?.categoryid)
    .filter((id): id is string | number => id != null && id !== "")
  const uniqueCategoryIds = Array.from(new Set(categoryIds.map((id) => String(id))))
    .map((id) => (/^\d+$/.test(id) ? Number(id) : id))

  if (uniqueCategoryIds.length === 0) return list

  const tables = ["categories", "category"]
  let categoryRows: Array<Record<string, unknown>> = []
  let fetched = false

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select("id,name")
      .in("id", uniqueCategoryIds as (string | number)[])

    if (!error && Array.isArray(data)) {
      categoryRows = data as Array<Record<string, unknown>>
      fetched = true
      break
    }

    const message = typeof error?.message === "string" ? error.message : ""
    const missingRelation =
      message.includes("Could not find the table") ||
      message.includes("relation") ||
      message.includes("does not exist")
    if (!missingRelation) {
      return list
    }
  }

  if (!fetched) return list

  const byId = new Map<string, string>()
  for (const row of categoryRows) {
    const id = row?.id == null ? "" : String(row.id)
    const name = typeof row?.name === "string" ? row.name : ""
    if (!id || !name) continue
    byId.set(id, name)
  }

  return list.map((p) => {
    const rawId = p?.category_id ?? p?.categoryid
    const id = rawId == null ? "" : String(rawId)
    const categoryName = id ? byId.get(id) : undefined
    if (!categoryName) return p
    return { ...p, category: categoryName }
  })
}

function normalizeProduct(row: ProductRow): Product | null {
  const id = row?.id == null ? "" : String(row.id).trim()
  const slug =
    row?.slug == null
      ? null
      : String(row.slug).trim() || null
  const name = row?.name == null ? "" : String(row.name).trim()
  const priceNum = Number(row?.price)

  if (!id || !name || !Number.isFinite(priceNum)) return null

  const image =
    typeof row?.image === "string"
      ? row.image.trim()
      : typeof row?.thumbnail_url === "string"
        ? row.thumbnail_url.trim()
        : undefined
  const image_url =
    typeof row?.image_url === "string"
      ? row.image_url.trim()
      : typeof row?.thumbnail_url === "string"
        ? row.thumbnail_url.trim()
        : undefined
  const description = coerceProductDetailText(row?.description)
  const category =
    row?.category != null && String(row.category).trim()
      ? String(row.category).trim()
      : (row?.category_id ?? row?.categoryid) == null
        ? undefined
        : String(row?.category_id ?? row?.categoryid).trim() || undefined
  const stockNum = Number(row?.stock)
  const stock = Number.isFinite(stockNum) ? stockNum : undefined

  const brandRaw = row?.brand ?? row?.brand_name
  const brand =
    brandRaw != null && String(brandRaw).trim() ? String(brandRaw).trim() : null

  const sizeRaw = row?.size_label ?? row?.size ?? row?.item_size
  const size_label =
    sizeRaw != null && String(sizeRaw).trim() ? String(sizeRaw).trim() : null

  const colorRaw = row?.color ?? row?.colour
  const color =
    colorRaw != null && String(colorRaw).trim() ? String(colorRaw).trim() : null

  const productDetails = row?.product_details
  const benefit = coerceProductDetailText(
    row?.benefit,
    row?.benefits,
    row?.benefit_text,
    row?.product_benefit,
    getDetailField(productDetails, ["benefit", "benefits", "benefit_text"])
  )
  const ingredients = coerceProductDetailText(
    row?.ingredients,
    row?.ingredient,
    row?.ingredients_text,
    row?.ingredient_list,
    getDetailField(productDetails, ["ingredients", "ingredient", "ingredients_text"])
  )
  const analysis = coerceProductDetailText(
    row?.analysis,
    getDetailField(productDetails, ["analysis"])
  )
  const feeding_instructions = coerceProductDetailText(
    row?.feeding_instructions,
    row?.feeding_instruction,
    row?.feed_instruction,
    getDetailField(productDetails, [
      "feeding_instructions",
      "feeding_instruction",
      "feed_instruction",
      "feedingInstructions",
      "feeding",
    ])
  )
  const delivery_badge_text =
    row?.delivery_badge_text == null
      ? null
      : typeof row.delivery_badge_text === "string"
        ? row.delivery_badge_text
        : null

  return {
    id,
    slug,
    name,
    price: Math.max(0, priceNum),
    image: image || undefined,
    image_url: image_url || undefined,
    description,
    category,
    stock,
    brand,
    size_label,
    size: size_label,
    color,
    benefit,
    ingredients,
    analysis,
    feeding_instructions,
    delivery_badge_text,
  }
}

/** Gallery URLs for PDP (product_images). Empty if table missing or no rows. */
async function fetchProductGalleryUrls(productId: string | number): Promise<string[]> {
  const { data, error } = await supabase
    .from("product_images")
    .select("image_url,is_main,sort_order")
    .eq("product_id", productId)

  if (error || !Array.isArray(data) || data.length === 0) return []

  const rows = data
    .filter((r) => typeof r.image_url === "string" && String(r.image_url).trim())
    .map((r) => ({
      url: String(r.image_url).trim(),
      is_main: Boolean(r.is_main),
      sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
    }))
    .sort((a, b) => {
      if (a.is_main !== b.is_main) return a.is_main ? -1 : 1
      return a.sort_order - b.sort_order
    })

  const urls = rows.map((r) => toPublicSupabaseUrl(r.url)).filter(Boolean)
  return Array.from(new Set(urls))
}

async function fetchProductDetailsRow(productId: string | number, db = supabase): Promise<ProductRow | null> {
  const { data, error } = await db
    .from("product_details")
    .select("*")
    .eq("product_id", productId)
    .limit(1)

  if (!error && Array.isArray(data) && data.length > 0) {
    const first = data[0]
    if (!first || typeof first !== "object") return null
    return first as ProductRow
  }

  if (typeof productId !== "string") return null

  const slug = productId.trim()
  if (!slug) return null

  const { data: slugData, error: slugError } = await db
    .from("product_details")
    .select("*")
    .eq("slug", slug)
    .limit(1)

  if (slugError || !Array.isArray(slugData) || slugData.length === 0) return null
  const first = slugData[0]
  if (!first || typeof first !== "object") return null
  return first as ProductRow
}

function sanitizePaging(options?: ProductQueryOptions): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(options?.page ?? 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(options?.pageSize ?? DEFAULT_PRODUCT_PAGE_SIZE))))
  return { page, pageSize }
}

async function queryProductList(options?: ProductQueryOptions): Promise<Product[]> {
  const { page, pageSize } = sanitizePaging(options)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const rows = await selectProductsWithFallback((selectColumns) => {
    const query = supabase.from("products").select(selectColumns)
    return query.range(from, to)
  })
  const withImages = await attachProductImages(rows as ProductRow[])
  return withImages
    .filter((row) => isProductVisible(row as ProductRow))
    .map((row) => normalizeProduct(row as ProductRow))
    .filter(isValidProduct)
}

export async function getProducts(options?: ProductQueryOptions): Promise<Product[]> {
  return queryProductList(options)
}

export async function getProductsPage(options?: ProductQueryOptions): Promise<ProductPageResult> {
  const { page, pageSize } = sanitizePaging(options)
  const probeRows = await queryProductList({ ...options, page, pageSize: pageSize + 1 })
  const hasNextPage = probeRows.length > pageSize
  const items = hasNextPage ? probeRows.slice(0, pageSize) : probeRows
  return {
    items,
    page,
    pageSize,
    hasNextPage,
  }
}

export async function searchProducts(keyword: string, options?: SearchProductsOptions): Promise<Product[]> {
  const { page, pageSize } = sanitizePaging(options)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data } = await supabase
    .from("products")
    .select("id,name,slug,price,thumbnail_url,category_id,stock,brand,size,color,status")
    .eq("status", "active")
    .ilike("name", `%${keyword}%`)
    .range(from, to)

  const rows = Array.isArray(data) ? (data as ProductRow[]) : []
  const withImages = await attachProductImages(rows)
  return withImages
    .filter((row) => isProductVisible(row as ProductRow))
    .map((row) => normalizeProduct(row as ProductRow))
    .filter(isValidProduct)
}

export async function getProductById(productId: string | number): Promise<Product | null> {
  const id = productId
  const db = getServerWriteClient()
  const [{ data, error }, detailsRow] = await Promise.all([
    db
    .from("products")
    .select("*")
    .eq("id", id as string | number)
      .single(),
    fetchProductDetailsRow(id, db),
  ])

  if (error || !data) return null

  const [withCategoryRows, galleryUrls] = await Promise.all([
    attachCategoryNames([{
      ...(data as ProductRow),
      ...(detailsRow ?? {}),
    }]),
    fetchProductGalleryUrls(id),
  ])

  const withCategory = withCategoryRows[0] as ProductRow
  if (!isProductVisible(withCategory)) return null
  const normalized = normalizeProduct(withCategory)
  if (!normalized) return null

  const mainFallback = resolveProductImageUrl(normalized)
  const fallbackGallery = mainFallback ? [mainFallback] : []
  const gallery_images = galleryUrls.length > 0 ? galleryUrls : fallbackGallery

  const primaryImage = gallery_images[0] || mainFallback
  const product = {
    ...normalized,
    image: normalized.image ?? primaryImage,
    image_url: normalized.image_url ?? primaryImage,
    gallery_images,
  }
  return isValidProduct(product) ? product : null
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const safeSlug = String(slug ?? "").trim()
  if (!safeSlug) return null
  const db = getServerWriteClient()

  const { data, error } = await db
    .from("products")
    .select("id")
    .eq("slug", safeSlug)
    .single()

  if (error || !data?.id) return null
  return getProductById(data.id as string | number)
}

export async function getRelatedProducts(
  productId: string | number,
  limit = 4
): Promise<Product[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 4
  const seedCount = Math.max(8, safeLimit * 3)

  const { data } = await supabase
    .from("products")
    .select("*")
    .neq("id", productId as string | number)
    .limit(seedCount)

  const seededRows = Array.isArray(data) ? (data as ProductRow[]) : []
  const withImages = await attachProductImages(seededRows)
  const withCategories = await attachCategoryNames(withImages as ProductRow[])
  return withCategories
    .filter((row) => isProductVisible(row as ProductRow))
    .map((row) => normalizeProduct(row as ProductRow))
    .filter(isValidProduct)
    .slice(0, safeLimit)
}

/** Decrement product stock by quantity. Throws if insufficient stock. */
export async function decrementStock(
  productId: string | number,
  quantity: number,
  inventoryLog?: InventoryLogInput
) {
  if (productId == null || productId === "") throw new Error("Invalid product id")
  // Use number when it's a numeric string so we match integer primary keys in Supabase
  const id =
    typeof productId === "string" && /^\d+$/.test(productId)
      ? Number(productId)
      : productId
  const db = getServerWriteClient()

  const normalizedQty = Math.max(1, Math.floor(Number(quantity)))
  if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
    throw new Error("Invalid quantity")
  }

  const { data: row, error: fetchError } = await db
    .from("products")
    .select("stock")
    .eq("id", id)
    .single()

  if (fetchError || row == null) {
    throw new Error(`Product not found (id: ${productId}). ${fetchError?.message ?? ""}`.trim())
  }
  const current = row.stock != null ? Number(row.stock) : 0
  const newStock = current - normalizedQty
  if (newStock < 0) throw new Error(`Insufficient stock for product ${productId}`)

  const { data: updatedRows, error: updateError } = await db
    .from("products")
    .update({ stock: newStock })
    .eq("id", id as string | number)
    .select("id,stock")

  if (updateError) throw updateError
  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    throw new Error(
      "Stock update was blocked (no rows updated). Check products UPDATE RLS policy or use SUPABASE_SERVICE_ROLE_KEY."
    )
  }

  try {
    await insertInventoryLogSafely({
      product_id: typeof id === "number" ? id : Number(id),
      order_id: inventoryLog?.order_id ?? null,
      order_number: inventoryLog?.order_number ?? null,
      action: "decrement",
      quantity: normalizedQty,
      stock_before: current,
      stock_after: newStock,
      note: inventoryLog?.note ?? "Checkout stock deduction",
    }, db)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : String(err)
    throw new Error(`Stock updated but inventory log failed: ${message}`)
  }
}
