import { createClient } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { Product } from "@/types"

type ProductRow = Record<string, unknown> & { id?: string | number }

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
  const ids = list
    .map((p) => p?.id)
    .filter((id): id is string | number => id != null && id !== "")

  if (ids.length === 0) return list

  // Fetch images from known table names and merge onto products as image_url.
  // Supabase defaults to the "public" schema.
  const imageTables = ["product_images"]
  let images: Array<Record<string, unknown>> = []
  let fetched = false

  for (const table of imageTables) {
    const { data, error } = await supabase
      .from(table)
      .select("product_id,image_url,is_main,sort_order")
      .in("product_id", ids as (string | number)[])

    if (!error && Array.isArray(data)) {
      if (debugImageSync) {
        console.log("[productService] image table fetch success", {
          table,
          requestedProductIds: ids.length,
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
  const categoryIds = list
    .map((p) => p?.category_id ?? p?.categoryid)
    .filter((id): id is string | number => id != null && id !== "")

  if (categoryIds.length === 0) return list

  const tables = ["categories", "category"]
  let categoryRows: Array<Record<string, unknown>> = []
  let fetched = false

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select("id,name")
      .in("id", categoryIds as (string | number)[])

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
  const id = row?.id == null ? "" : String(row.id)
  const name = typeof row?.name === "string" ? row.name.trim() : ""
  const priceNum = Number(row?.price)

  if (!id || !name || !Number.isFinite(priceNum)) return null

  const image = typeof row?.image === "string" ? row.image : undefined
  const image_url = typeof row?.image_url === "string" ? row.image_url : undefined
  const description =
    row?.description == null
      ? null
      : typeof row.description === "string"
        ? row.description
        : null
  const category =
    typeof row?.category === "string"
      ? row.category
      : (row?.category_id ?? row?.categoryid) == null
        ? undefined
        : String(row?.category_id ?? row?.categoryid)
  const stockNum = Number(row?.stock)
  const stock = Number.isFinite(stockNum) ? stockNum : undefined

  return {
    id,
    name,
    price: priceNum,
    image,
    image_url,
    description,
    category,
    stock,
  }
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")

  if (error) throw error
  const withImages = await attachProductImages((data ?? []) as ProductRow[])
  const withCategories = await attachCategoryNames(withImages as ProductRow[])
  return withCategories
    .map((row) => normalizeProduct(row as ProductRow))
    .filter((p): p is Product => p != null)
}

export async function searchProducts(keyword: string): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("*")
    .ilike("name", `%${keyword}%`)

  const withImages = await attachProductImages((data ?? []) as ProductRow[])
  const withCategories = await attachCategoryNames(withImages as ProductRow[])
  return withCategories
    .map((row) => normalizeProduct(row as ProductRow))
    .filter((p): p is Product => p != null)
}

export async function getProductById(productId: string | number): Promise<Product> {
  const id = productId
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id as string | number)
    .single()

  if (error || !data) throw error ?? new Error("Product not found")

  const [withImage] = await attachProductImages([data as ProductRow])
  const [withCategory] = await attachCategoryNames([withImage as ProductRow])
  const normalized = normalizeProduct(withCategory as ProductRow)
  if (!normalized) throw new Error("Product shape is invalid")
  return normalized
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