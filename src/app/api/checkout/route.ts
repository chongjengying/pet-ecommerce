import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  fetchUserAddresses,
  getDefaultUserAddress,
  isCompleteShippingAddress,
} from "@/lib/userAddressDb";
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
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sign in to place an order. Add a full shipping address on your profile (line 1, city, state, postal code, country) before checkout.",
      },
      { status: 401 }
    );
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout is not configured." },
      { status: 503 }
    );
  }

  const addresses = await fetchUserAddresses(supabase, session.sub);
  const shipTo = getDefaultUserAddress(addresses);
  if (!shipTo || !isCompleteShippingAddress(shipTo)) {
    return NextResponse.json(
      {
        error:
          "Add a complete shipping address on your profile before checkout (line 1, city, state, postal code, country).",
      },
      { status: 400 }
    );
  }

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
      user_id: session.sub,
      subtotal,
      shipping_fee: 0,
      tax_amount: 0,
      currency: "MYR",
      metadata: {
        item_count: orderItems.length,
        shipping: {
          label: shipTo.label,
          line1: shipTo.line1,
          line2: shipTo.line2,
          city: shipTo.city,
          state: shipTo.state,
          postal_code: shipTo.postal_code,
          country: shipTo.country,
        },
      },
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
