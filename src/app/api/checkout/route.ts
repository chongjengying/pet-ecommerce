import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveSessionUser } from "@/lib/customerProfile";
import {
  fetchUserAddresses,
  getDefaultUserAddress,
  isCompleteShippingAddress,
} from "@/lib/userAddressDb";
import { userIdForDbQuery } from "@/lib/userIdDb";
import { finalizeCartAfterCheckout } from "@/lib/cartDb";
import { decrementStock } from "@/services/productService";
import { createOrder } from "@/services/orderService";

type CartItemPayload = {
  id: string | number;
  quantity: number;
  name?: string;
  price?: number;
};

type CheckoutAddressPayload = {
  country?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  city?: unknown;
  state?: unknown;
  postal_code?: unknown;
  phone?: unknown;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeQty(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.floor(n));
}

async function resolveCheckoutOrderUserId(
  _supabase: ReturnType<typeof getSupabaseServerClient>,
  _session: { sub: string; email: string },
  fallbackUserId: string
): Promise<string | number> {
  return userIdForDbQuery(fallbackUserId);
}

export async function POST(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sign in to place an order. Add a full shipping address in Address Book (line 1, city, state, postal code, country) before checkout.",
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

  const resolvedUser = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolvedUser) {
    return NextResponse.json(
      { error: "Profile not found." },
      { status: 404 }
    );
  }
  const orderUserId = await resolveCheckoutOrderUserId(supabase, session, resolvedUser.id);

  const addresses = await fetchUserAddresses(supabase, resolvedUser.id);
  const shipTo = getDefaultUserAddress(addresses);
  if (!shipTo || !isCompleteShippingAddress(shipTo)) {
    return NextResponse.json(
      {
        error:
          "Add a complete shipping address in Address Book before checkout (line 1, city, state, postal code, country).",
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
  const shippingAddress = ((body as { shipping_address?: unknown })?.shipping_address ?? null) as CheckoutAddressPayload | null;
  const billingAddress = ((body as { billing_address?: unknown })?.billing_address ?? null) as CheckoutAddressPayload | null;
  const billingSameAsShipping = Boolean((body as { billing_same_as_shipping?: unknown })?.billing_same_as_shipping ?? true);
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

  const shippingAddressLine1 = cleanText(shippingAddress?.address_line1) ?? shipTo.address_line1;
  const shippingAddressLine2 = cleanText(shippingAddress?.address_line2) ?? shipTo.address_line2;
  const shippingCity = cleanText(shippingAddress?.city) ?? shipTo.city;
  const shippingState = cleanText(shippingAddress?.state) ?? shipTo.state;
  const shippingPostalCode = cleanText(shippingAddress?.postal_code) ?? shipTo.postal_code;
  const shippingCountry = cleanText(shippingAddress?.country) ?? shipTo.country;
  const shippingFirstName = cleanText(shippingAddress?.first_name);
  const shippingLastName = cleanText(shippingAddress?.last_name);
  const shippingPhone = cleanText(shippingAddress?.phone);
  const shippingRecipientName = [shippingFirstName, shippingLastName].filter(Boolean).join(" ").trim() || null;

  // 1) Save order first
  let createdOrder: Awaited<ReturnType<typeof createOrder>> | null = null;
  try {
    createdOrder = await createOrder(orderItems, {
      user_id: orderUserId,
      subtotal,
      shipping_fee: 0,
      tax_amount: 0,
      discount: 0,
      currency: "MYR",
      payment_status: "paid",
      shipping_method: "free_shipping",
      tracking_number: null,
      shipping_name: shippingRecipientName,
      shipping_phone: shippingPhone,
      shipping_address_line_1: shippingAddressLine1,
      shipping_address_line_2: shippingAddressLine2,
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_postal_code: shippingPostalCode,
      shipping_country: shippingCountry,
      metadata: {
        customer: {
          auth_sub: String(session.sub),
          public_user_id: String(resolvedUser.id),
          email: String(session.email),
          username: String(session.username),
        },
        contact: {
          email: String(session.email),
          username: String(session.username),
          full_name: resolvedUser.full_name ?? null,
          phone: shippingPhone,
        },
        item_count: orderItems.length,
        shipping: {
          label: shipTo.label,
          first_name: shippingFirstName,
          last_name: shippingLastName,
          recipient_name: shippingRecipientName,
          phone: shippingPhone,
          address_line1: shippingAddressLine1,
          address_line2: shippingAddressLine2,
          city: shippingCity,
          state: shippingState,
          postal_code: shippingPostalCode,
          country: shippingCountry,
        },
        billing: billingSameAsShipping
          ? {
              same_as_shipping: true,
            }
          : {
              same_as_shipping: false,
              first_name: billingAddress?.first_name ? String(billingAddress.first_name) : null,
              last_name: billingAddress?.last_name ? String(billingAddress.last_name) : null,
              phone: billingAddress?.phone ? String(billingAddress.phone) : null,
              address_line1: billingAddress?.address_line1 ? String(billingAddress.address_line1) : null,
              address_line2: billingAddress?.address_line2 ? String(billingAddress.address_line2) : null,
              city: billingAddress?.city ? String(billingAddress.city) : null,
              state: billingAddress?.state ? String(billingAddress.state) : null,
              postal_code: billingAddress?.postal_code ? String(billingAddress.postal_code) : null,
              country: billingAddress?.country ? String(billingAddress.country) : null,
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
    const lowerMsg = msg.toLowerCase();
    const ordersMissing =
      (lowerMsg.includes("relation") && (lowerMsg.includes("orders") || lowerMsg.includes("order_items"))) ||
      (lowerMsg.includes("does not exist") && (lowerMsg.includes("orders") || lowerMsg.includes("order_items")));
    const hint = ordersMissing
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

  const cartFinalizeError = await finalizeCartAfterCheckout(
    supabase,
    userIdForDbQuery(resolvedUser.id)
  );
  if (cartFinalizeError) {
    console.warn("[api/checkout POST] Cart finalize failed after successful checkout", {
      user_id: resolvedUser.id,
      error: cartFinalizeError,
    });
  }

  return NextResponse.json({
    success: true,
    order: {
      id: createdOrder?.id ?? null,
      order_number: createdOrder?.order_number ?? null,
      subtotal,
      shipping_fee: 0,
      tax_amount: 0,
      total_amount: subtotal,
      currency: "MYR",
      shipping: {
        recipient_name: shippingRecipientName,
        phone: shippingPhone,
        address_line1: shippingAddressLine1,
        address_line2: shippingAddressLine2,
        city: shippingCity,
        state: shippingState,
        postal_code: shippingPostalCode,
        country: shippingCountry,
      },
      items: orderItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        line_total: Number(item.price) * item.quantity,
      })),
    },
  });
}
