import { NextResponse } from "next/server"
import { decrementStock } from "@/services/productService"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const items = body?.items as Array<{ id: string | number; quantity: number }> | undefined
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty or invalid payload" },
        { status: 400 }
      )
    }

    for (const item of items) {
      const id = item?.id
      const qty = Number(item?.quantity)
      if (id == null || !Number.isFinite(qty) || qty <= 0) continue
      await decrementStock(id, qty)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
