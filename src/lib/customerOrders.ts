import type { CustomerJwtPayload } from "@/lib/customerJwt";
import { resolveSessionUser } from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";

type OrderItemRow = {
  product_id?: number | null;
  quantity?: number | null;
  unit_price?: number | null;
  product_name?: string | null;
  price?: number | null;
  name?: string | null;
};

type OrderSelectRow = {
  id?: string | number | null;
  order_number?: string | null;
  created_at?: string | null;
  status?: string | null;
  subtotal?: number | null;
  shipping_fee?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
  order_items?: OrderItemRow[] | null;
};

export type CustomerOrderStatusItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type CustomerOrderStatusData = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  notes: string | null;
  items: CustomerOrderStatusItem[];
  shipping: {
    label: string | null;
    recipientName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    courier: string | null;
    trackingNumber: string | null;
    etaLabel: string | null;
  };
  payment: {
    status: string;
    method: string;
    paidAt: string | null;
    cardLabel: string | null;
  };
};

function isMissingColumnError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the") ||
    message.includes("schema cache")
  );
}

function cleanMaybeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeCurrency(value: unknown): string {
  return cleanMaybeString(value) ?? "MYR";
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(value: unknown): string {
  return cleanMaybeString(value)?.toLowerCase() ?? "processing";
}

function defaultPaymentStatus(orderStatus: string): string {
  return orderStatus === "cancelled" ? "Refund pending" : "Paid";
}

function defaultPaymentMethod(paymentMeta: Record<string, unknown> | null): string {
  return (
    cleanMaybeString(paymentMeta?.method) ??
    cleanMaybeString(paymentMeta?.channel) ??
    "Online payment"
  );
}

function buildItems(rows: OrderItemRow[] | null | undefined): CustomerOrderStatusItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index) => {
    const quantity = Math.max(1, normalizeNumber(row.quantity, 1));
    const unitPrice = normalizeNumber(row.unit_price ?? row.price, 0);
    return {
      id: String(row.product_id ?? index + 1),
      name: cleanMaybeString(row.product_name ?? row.name) ?? "Pet care item",
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
    };
  });
}

function buildShipping(metadata: Record<string, unknown> | null) {
  const shippingMeta = asRecord(metadata?.shipping);
  return {
    label: cleanMaybeString(shippingMeta?.label),
    recipientName: cleanMaybeString(shippingMeta?.recipient_name),
    addressLine1: cleanMaybeString(shippingMeta?.address_line1),
    addressLine2: cleanMaybeString(shippingMeta?.address_line2),
    city: cleanMaybeString(shippingMeta?.city),
    state: cleanMaybeString(shippingMeta?.state),
    postalCode: cleanMaybeString(shippingMeta?.postal_code),
    country: cleanMaybeString(shippingMeta?.country),
    courier:
      cleanMaybeString(shippingMeta?.courier) ??
      cleanMaybeString(metadata?.courier_name) ??
      "Pawluxe Express",
    trackingNumber:
      cleanMaybeString(shippingMeta?.tracking_number) ??
      cleanMaybeString(metadata?.tracking_number),
    etaLabel:
      cleanMaybeString(shippingMeta?.estimated_delivery) ??
      cleanMaybeString(metadata?.estimated_delivery),
  };
}

function buildPayment(metadata: Record<string, unknown> | null, orderStatus: string) {
  const paymentMeta = asRecord(metadata?.payment);
  return {
    status: cleanMaybeString(paymentMeta?.status) ?? defaultPaymentStatus(orderStatus),
    method: defaultPaymentMethod(paymentMeta),
    paidAt: cleanMaybeString(paymentMeta?.paid_at),
    cardLabel:
      cleanMaybeString(paymentMeta?.card_last4)
        ? `Ending in ${cleanMaybeString(paymentMeta?.card_last4)}`
        : cleanMaybeString(paymentMeta?.card_label),
  };
}

function mapLatestOrder(row: OrderSelectRow): CustomerOrderStatusData {
  const items = buildItems(row.order_items);
  const subtotal =
    row.subtotal != null ? normalizeNumber(row.subtotal, 0) : items.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingFee = normalizeNumber(row.shipping_fee, 0);
  const taxAmount = normalizeNumber(row.tax_amount, 0);
  const totalAmount =
    row.total_amount != null ? normalizeNumber(row.total_amount, 0) : subtotal + shippingFee + taxAmount;
  const status = normalizeStatus(row.status);
  const metadata = asRecord(row.metadata);

  return {
    id: String(row.id ?? ""),
    orderNumber: cleanMaybeString(row.order_number) ?? `#${String(row.id ?? "").slice(0, 8).toUpperCase()}`,
    createdAt: cleanMaybeString(row.created_at) ?? new Date().toISOString(),
    status,
    subtotal,
    shippingFee,
    taxAmount,
    totalAmount,
    currency: normalizeCurrency(row.currency),
    notes: cleanMaybeString(row.notes),
    items,
    shipping: buildShipping(metadata),
    payment: buildPayment(metadata, status),
  };
}

export async function loadLatestCustomerOrderStatus(
  session: Pick<CustomerJwtPayload, "sub" | "username" | "email">
): Promise<CustomerOrderStatusData | null> {
  const supabase = getSupabaseServerClient();
  const resolvedUser = await resolveSessionUser(supabase, session);
  if (!resolvedUser) {
    return null;
  }

  const userIdKey = userIdForDbQuery(resolvedUser.id);
  const selectAttempts = [
    "id, order_number, created_at, status, subtotal, shipping_fee, tax_amount, total_amount, currency, metadata, notes, order_items(product_id, product_name, unit_price, quantity)",
    "id, order_number, created_at, status, subtotal, shipping_fee, tax_amount, total_amount, currency, metadata, order_items(product_id, product_name, unit_price, quantity)",
    "id, order_number, created_at, status, total_amount, currency, metadata, order_items(product_id, product_name, unit_price, quantity)",
    "id, created_at, status, total_amount, metadata, order_items(product_id, quantity)",
  ] as const;

  for (const select of selectAttempts) {
    const { data, error } = await supabase
      .from("orders")
      .select(select)
      .eq("user_id", userIdKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      return data ? mapLatestOrder(data as OrderSelectRow) : null;
    }

    if (!isMissingColumnError(error)) {
      throw new Error(error.message || "Could not load customer order.");
    }
  }

  return null;
}
