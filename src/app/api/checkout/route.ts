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
import { finalizeCartAfterCheckout, getCartView } from "@/lib/cartDb";
import { decrementStock } from "@/services/productService";
import { createOrder } from "@/services/orderService";
import { createPayment } from "@/services/paymentService";
import { sendCheckoutEmailNotification } from "@/lib/emailNotifications";
import { readEmailVerificationStatus } from "@/lib/emailVerification";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type CheckoutPaymentMethod = "adaptis_gateway" | "grab" | "bank_transfer";
const FREE_SHIPPING_THRESHOLD = 150;
const FLAT_SHIPPING_FEE = 12;
const TAX_RATE = 0;

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

function normalizeDbId(value: string | number): string | number {
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;
  }
  return raw;
}

function buildCheckoutReference(orderNumber: string | null, orderId: string | null) {
  const base = (orderNumber ?? orderId ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase();
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `PAY-${base || "ORDER"}-${stamp}`;
}

function calculateCheckoutPricing(subtotal: number) {
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
  const taxAmount = Number((subtotal * TAX_RATE).toFixed(2));
  const totalAmount = Number((subtotal + shippingFee + taxAmount).toFixed(2));
  return { shippingFee, taxAmount, totalAmount };
}

function isMissingOrderAddressesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    message.includes("order_addresses") &&
    (message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache"))
  );
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
  const accountEmail = String(resolvedUser.email ?? "").trim() || String(session.email ?? "").trim();
  if (!accountEmail) {
    return NextResponse.json(
      { error: "Account email is missing. Please update your profile email before checkout." },
      { status: 400 }
    );
  }
  const verificationStatus = await readEmailVerificationStatus(supabase, resolvedUser.id);
  if (verificationStatus.error) {
    return NextResponse.json({ error: verificationStatus.error }, { status: 400 });
  }
  if (verificationStatus.configured && !verificationStatus.isEmailVerified) {
    return NextResponse.json(
      {
        error:
          "Check your email to verify your account before checkout. Use 'Resend verification email' from the banner if needed.",
      },
      { status: 403 }
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
      { error: "Invalid request body. Send JSON." },
      { status: 400 }
    );
  }

  const shippingAddress = ((body as { shipping_address?: unknown })?.shipping_address ?? null) as CheckoutAddressPayload | null;
  const billingAddress = ((body as { billing_address?: unknown })?.billing_address ?? null) as CheckoutAddressPayload | null;
  const billingSameAsShipping = Boolean((body as { billing_same_as_shipping?: unknown })?.billing_same_as_shipping ?? true);
  const paymentMethod = String((body as { payment_method?: unknown })?.payment_method ?? "adaptis_gateway").trim() as CheckoutPaymentMethod;
  const cartViewResult = await getCartView(supabase, userIdForDbQuery(resolvedUser.id));
  if (cartViewResult.error || !cartViewResult.data) {
    return NextResponse.json(
      { error: cartViewResult.error?.message || "Could not load cart for checkout." },
      { status: 400 }
    );
  }
  if (!Array.isArray(cartViewResult.data.items) || cartViewResult.data.items.length === 0) {
    return NextResponse.json(
      { error: "Your cart is empty. Add items before checkout." },
      { status: 400 }
    );
  }

  const orderItems = cartViewResult.data.items.map((item) => ({
    id: item.product_id,
    quantity: normalizeQty(item.quantity),
    name: item.product?.name ?? "Product",
    price: Number.isFinite(Number(item.price_at_time)) ? Number(item.price_at_time) : 0,
  }));

  const paymentMethodConfig: Record<CheckoutPaymentMethod, { payment_method: string; provider: string; note: string }> = {
    adaptis_gateway: {
      payment_method: "Gateway Redirect",
      provider: "adaptis",
      note: "Customer will be redirected to ADAPTIS Payment Gateway (formerly iPay88).",
    },
    grab: {
      payment_method: "Buy Now Pay Later",
      provider: "grab",
      note: "Customer selected Grab payment flow.",
    },
    bank_transfer: {
      payment_method: "Bank Transfer / Cash Deposit",
      provider: "bank_transfer",
      note: "Customer selected offline transfer / cash deposit flow.",
    },
  };
  const selectedPaymentMethod = paymentMethodConfig[paymentMethod] ?? paymentMethodConfig.adaptis_gateway;
  const paymentStatus = "pending";

  const uniqueProductIds = Array.from(new Set(orderItems.map((item) => String(item.id).trim()).filter(Boolean)));
  if (uniqueProductIds.length === 0) {
    return NextResponse.json({ error: "Your cart is empty. Add items before checkout." }, { status: 400 });
  }

  const { data: stockRows, error: stockError } = await supabase
    .from("products")
    .select("id,stock")
    .in("id", uniqueProductIds.map((id) => normalizeDbId(id)));
  if (stockError) {
    return NextResponse.json({ error: stockError.message || "Could not validate stock." }, { status: 400 });
  }

  const stockByProductId = new Map<string, number | null>();
  for (const row of Array.isArray(stockRows) ? stockRows : []) {
    const id = String((row as { id?: unknown }).id ?? "").trim();
    if (!id) continue;
    const stockValue = Number((row as { stock?: unknown }).stock);
    stockByProductId.set(id, Number.isFinite(stockValue) ? Math.max(0, Math.floor(stockValue)) : null);
  }

  const unavailableItems = orderItems.reduce<Array<{ id: string; requested: number; available: number }>>(
    (acc, item) => {
      const productId = String(item.id);
      const available = stockByProductId.get(productId);
      if (available == null || item.quantity <= available) return acc;
      acc.push({ id: productId, requested: item.quantity, available });
      return acc;
    },
    []
  );

  if (unavailableItems.length > 0) {
    return NextResponse.json(
      {
        error: "Some items are no longer in stock with your requested quantity. Please update your cart and retry.",
        unavailable_items: unavailableItems,
      },
      { status: 409 }
    );
  }

  const subtotal = orderItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 0),
    0
  );
  const { shippingFee, taxAmount, totalAmount } = calculateCheckoutPricing(subtotal);

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
  const billingFirstName = cleanText(billingAddress?.first_name);
  const billingLastName = cleanText(billingAddress?.last_name);
  const billingPhone = cleanText(billingAddress?.phone);
  const billingRecipientName = [billingFirstName, billingLastName].filter(Boolean).join(" ").trim() || null;
  const billingAddressLine1 = cleanText(billingAddress?.address_line1);
  const billingAddressLine2 = cleanText(billingAddress?.address_line2);
  const billingCity = cleanText(billingAddress?.city);
  const billingState = cleanText(billingAddress?.state);
  const billingPostalCode = cleanText(billingAddress?.postal_code);
  const billingCountry = cleanText(billingAddress?.country);

  // 1) Save order first
  let createdOrder: Awaited<ReturnType<typeof createOrder>> | null = null;
  try {
    createdOrder = await createOrder(orderItems, {
      user_id: orderUserId,
      status: "pending",
      subtotal,
      shipping_fee: shippingFee,
      tax_amount: taxAmount,
      discount: 0,
      currency: "MYR",
      payment_status: paymentStatus,
      shipping_method: shippingFee === 0 ? "free_shipping" : "standard_shipping",
      tracking_number: null,
      shipping_name: shippingRecipientName,
      shipping_phone: shippingPhone,
      shipping_address_line_1: shippingAddressLine1,
      shipping_address_line_2: shippingAddressLine2,
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_postal_code: shippingPostalCode,
      shipping_country: shippingCountry,
      payment_method_code: paymentMethod,
      payment_provider: selectedPaymentMethod.provider,
      payment_snapshot: {
        method: paymentMethod,
        provider: selectedPaymentMethod.provider,
        label: selectedPaymentMethod.payment_method,
        note: selectedPaymentMethod.note,
      },
      metadata: {
        customer: {
          auth_sub: String(session.sub),
          public_user_id: String(resolvedUser.id),
          email: accountEmail,
          username: String(session.username),
        },
        contact: {
          email: accountEmail,
          username: String(session.username),
          full_name: resolvedUser.full_name ?? null,
          phone: shippingPhone,
        },
        item_count: orderItems.reduce((sum, item) => sum + item.quantity, 0),
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
        payment: {
          method: paymentMethod,
          provider: selectedPaymentMethod.provider,
          label: selectedPaymentMethod.payment_method,
          note: selectedPaymentMethod.note,
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

  // 1.5) Snapshot order addresses (shipping + billing) in dedicated table when available.
  try {
    const orderId = createdOrder?.id ?? null;
    if (orderId) {
      const addressRows = [
        {
          order_id: orderId,
          address_type: "shipping",
          name: shippingRecipientName,
          phone: shippingPhone,
          address_line1: shippingAddressLine1,
          address_line2: shippingAddressLine2,
          city: shippingCity,
          state: shippingState,
          postal_code: shippingPostalCode,
          country: shippingCountry,
        },
        {
          order_id: orderId,
          address_type: "billing",
          name: billingSameAsShipping ? shippingRecipientName : billingRecipientName,
          phone: billingSameAsShipping ? shippingPhone : billingPhone,
          address_line1: billingSameAsShipping ? shippingAddressLine1 : billingAddressLine1,
          address_line2: billingSameAsShipping ? shippingAddressLine2 : billingAddressLine2,
          city: billingSameAsShipping ? shippingCity : billingCity,
          state: billingSameAsShipping ? shippingState : billingState,
          postal_code: billingSameAsShipping ? shippingPostalCode : billingPostalCode,
          country: billingSameAsShipping ? shippingCountry : billingCountry,
        },
      ];

      const { error: orderAddressError } = await supabase.from("order_addresses").insert(addressRows);
      if (orderAddressError && !isMissingOrderAddressesTable(orderAddressError)) {
        console.warn("[api/checkout POST] order_addresses insert failed", {
          order_id: orderId,
          error: orderAddressError.message || String(orderAddressError),
        });
      }
    }
  } catch (orderAddressErr) {
    console.warn("[api/checkout POST] order_addresses snapshot failed", {
      order_id: createdOrder?.id ?? null,
      error: orderAddressErr instanceof Error ? orderAddressErr.message : String(orderAddressErr),
    });
  }

  // 2) Then deduct inventory
  try {
    for (const item of orderItems) {
      await decrementStock(item.id, item.quantity, {
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

  const emailResult = await sendCheckoutEmailNotification({
    to_email: accountEmail,
    to_name: resolvedUser.full_name ?? shippingRecipientName ?? null,
    order_number: createdOrder?.order_number ?? null,
    currency: "MYR",
    subtotal,
    shipping_fee: shippingFee,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    items: orderItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: Number(item.price),
      line_total: Number(item.price) * item.quantity,
    })),
  });
  if (!emailResult.sent) {
    console.warn("[api/checkout POST] Confirmation email failed", {
      user_id: resolvedUser.id,
      order_id: createdOrder?.id ?? null,
      order_number: createdOrder?.order_number ?? null,
      error: emailResult.error ?? "Unknown email error",
    });
  }

  // 3) Record payment transaction (non-blocking for checkout success).
  try {
      const orderId = createdOrder?.id ?? null;
      if (orderId) {
        const referenceNo = buildCheckoutReference(createdOrder?.order_number ?? null, orderId);
        const transactionId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : referenceNo;
        await createPayment({
          order_id: orderId,
          user_id: orderUserId,
          transaction_id: transactionId,
          reference_no: referenceNo,
          payment_method: selectedPaymentMethod.payment_method,
          provider: selectedPaymentMethod.provider,
          amount: totalAmount,
          currency: "MYR",
          status: paymentStatus,
          paid_at: null,
          review_status: "pending",
          metadata: {
            source: "checkout_api",
            order_number: createdOrder?.order_number ?? null,
            customer_email: accountEmail,
            selected_payment_method: paymentMethod,
          },
        });
      }
  } catch (paymentErr) {
    console.warn("[api/checkout POST] Payment insert failed after order success", {
      order_id: createdOrder?.id ?? null,
      error: paymentErr instanceof Error ? paymentErr.message : String(paymentErr),
    });
  }

  return NextResponse.json({
    success: true,
    email_notification: {
      sent: emailResult.sent,
      provider: emailResult.provider,
      error: emailResult.sent ? null : emailResult.error ?? "Email send failed.",
    },
    order: {
      id: createdOrder?.id ?? null,
      order_number: createdOrder?.order_number ?? null,
      subtotal,
      shipping_fee: shippingFee,
      tax_amount: taxAmount,
      total_amount: totalAmount,
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
