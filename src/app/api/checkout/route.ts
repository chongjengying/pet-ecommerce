import { NextResponse } from "next/server";
import { decrementStock } from "@/services/productService";
import { createOrder } from "@/services/orderService";

type CartItemPayload = {
  id: string | number;
  quantity: number;
  name?: string;
  price?: number;
};

function normalizeQty(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.floor(n));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Send JSON with an 'items' array." },
      { status: 400 }
    );
  }

  const items = (body as { items?: unknown })?.items as CartItemPayload[] | undefined;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Cart is empty or invalid payload. Expected { items: [{ id, quantity, name?, price? }] }." },
      { status: 400 }
    );
  }

  const validItems = items.filter(
    (item) =>
      item?.id != null &&
      normalizeQty(item?.quantity) > 0
  );
  if (validItems.length === 0) {
    return NextResponse.json(
      { error: "No valid items. Each item needs id and quantity > 0." },
      { status: 400 }
    );
  }

  const orderItems = validItems.map((item) => ({
    id: item.id,
    quantity: normalizeQty(item.quantity),
    name: item.name ?? "Product",
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
  }));

  const subtotal = orderItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 0),
    0
  );

  // 1) Save order first
  let createdOrder: Awaited<ReturnType<typeof createOrder>> | null = null;
  try {
    createdOrder = await createOrder(orderItems, {
      subtotal,
      shipping_fee: 0,
      tax_amount: 0,
      currency: "MYR",
      metadata: { item_count: orderItems.length },
    });
  } catch (orderErr) {
    const msg =
      orderErr instanceof Error
        ? orderErr.message
        : typeof (orderErr as { message?: string })?.message === "string"
          ? (orderErr as { message: string }).message
          : String(orderErr);
    const hint =
      msg.includes("does not exist") || msg.includes("relation")
        ? " Create the orders table in Supabase (run supabase-orders-table.sql in SQL Editor)."
        : "";
    return NextResponse.json(
      { error: `Could not save order: ${msg}${hint}` },
      { status: 400 }
    );
  }

  // 2) Then deduct inventory
  try {
    for (const item of validItems) {
      await decrementStock(item.id, normalizeQty(item.quantity), {
        order_id: createdOrder?.id ?? null,
        order_number: createdOrder?.order_number ?? null,
        note: `Checkout order ${createdOrder?.order_number ?? createdOrder?.id ?? ""}`.trim(),
      });
    }
  } catch (stockErr) {
    const msg =
      stockErr instanceof Error
        ? stockErr.message
        : typeof (stockErr as { message?: string })?.message === "string"
          ? (stockErr as { message: string }).message
          : String(stockErr);
    return NextResponse.json(
      { error: `Inventory update failed: ${msg}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
