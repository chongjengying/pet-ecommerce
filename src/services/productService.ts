import { supabase } from "@/lib/supabase"

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")

  if (error) throw error
  return data
}

export async function searchProducts(keyword: string) {
  const { data } = await supabase
    .from("products")
    .select("*")
    .ilike("name", `%${keyword}%`)

  return data || []
}

/** Decrement product stock by quantity. Throws if insufficient stock. */
export async function decrementStock(productId: string | number, quantity: number) {
  const id = typeof productId === "string" ? Number(productId) : productId
  if (Number.isNaN(id)) throw new Error("Invalid product id")

  const { data: row, error: fetchError } = await supabase
    .from("products")
    .select("stock")
    .eq("id", id)
    .single()

  if (fetchError || row == null) throw new Error("Product not found")
  const current = row.stock != null ? Number(row.stock) : 0
  const newStock = current - quantity
  if (newStock < 0) throw new Error(`Insufficient stock for product ${productId}`)

  const { error: updateError } = await supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", id)

  if (updateError) throw updateError
}