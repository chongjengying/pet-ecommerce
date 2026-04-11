import type { CustomerJwtPayload } from "@/lib/customerJwt";
import { resolveSessionUser } from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";

type OrderItemRow = {
  order_id?: string | number | null;
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
  payment_status?: string | null;
  shipping_method?: string | null;
  tracking_number?: string | null;
  subtotal?: number | null;
  shipping_fee?: number | null;
  tax_amount?: number | null;
  discount?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address_line_1?: string | null;
  shipping_address_line_2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
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
    phone: string | null;
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

function isInvalidTypeFilterError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("invalid input syntax") || message.includes("operator does not exist");
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

function buildShipping(row: OrderSelectRow, metadata: Record<string, unknown> | null) {
  const shippingMeta = asRecord(metadata?.shipping);
  const firstName = cleanMaybeString(shippingMeta?.first_name);
  const lastName = cleanMaybeString(shippingMeta?.last_name);
  const combinedRecipient = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    label: cleanMaybeString(shippingMeta?.label),
    recipientName:
      cleanMaybeString(row.shipping_name) ??
      (combinedRecipient || cleanMaybeString(shippingMeta?.recipient_name)),
    phone:
      cleanMaybeString(row.shipping_phone) ??
      cleanMaybeString(shippingMeta?.phone) ??
      cleanMaybeString(asRecord(metadata?.contact)?.phone),
    addressLine1:
      cleanMaybeString(row.shipping_address_line_1) ??
      cleanMaybeString(shippingMeta?.address_line1) ??
      cleanMaybeString(shippingMeta?.address_line_1),
    addressLine2:
      cleanMaybeString(row.shipping_address_line_2) ??
      cleanMaybeString(shippingMeta?.address_line2) ??
      cleanMaybeString(shippingMeta?.address_line_2),
    city: cleanMaybeString(row.shipping_city) ?? cleanMaybeString(shippingMeta?.city),
    state: cleanMaybeString(row.shipping_state) ?? cleanMaybeString(shippingMeta?.state),
    postalCode:
      cleanMaybeString(row.shipping_postal_code) ??
      cleanMaybeString(shippingMeta?.postal_code),
    country: cleanMaybeString(row.shipping_country) ?? cleanMaybeString(shippingMeta?.country),
    courier:
      cleanMaybeString(row.shipping_method) ??
      cleanMaybeString(shippingMeta?.courier) ??
      cleanMaybeString(metadata?.courier_name) ??
      "Pawluxe Express",
    trackingNumber:
      cleanMaybeString(row.tracking_number) ??
      cleanMaybeString(shippingMeta?.tracking_number) ??
      cleanMaybeString(metadata?.tracking_number),
    etaLabel:
      cleanMaybeString(shippingMeta?.estimated_delivery) ??
      cleanMaybeString(metadata?.estimated_delivery),
  };
}

function buildPayment(row: OrderSelectRow, metadata: Record<string, unknown> | null, orderStatus: string) {
  const paymentMeta = asRecord(metadata?.payment);
  return {
    status:
      cleanMaybeString(row.payment_status) ??
      cleanMaybeString(paymentMeta?.status) ??
      defaultPaymentStatus(orderStatus),
    method: defaultPaymentMethod(paymentMeta),
    paidAt: cleanMaybeString(paymentMeta?.paid_at),
    cardLabel:
      cleanMaybeString(paymentMeta?.card_last4)
        ? `Ending in ${cleanMaybeString(paymentMeta?.card_last4)}`
        : cleanMaybeString(paymentMeta?.card_label),
  };
}

function mapOrder(row: OrderSelectRow): CustomerOrderStatusData {
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
    shipping: buildShipping(row, metadata),
    payment: buildPayment(row, metadata, status),
  };
}

async function fetchOrderItemsMap(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  orderIds: string[]
): Promise<Map<string, OrderItemRow[]>> {
  const result = new Map<string, OrderItemRow[]>();
  if (orderIds.length === 0) return result;

  const selectAttempts = [
    "order_id,product_id,product_name,unit_price,quantity",
    "order_id,product_id,name,price,quantity",
    "order_id,product_id,product_name,unit_price,name,price,quantity",
    "order_id,product_id,quantity",
  ] as const;

  for (const select of selectAttempts) {
    const { data, error } = await supabase
      .from("order_items")
      .select(select)
      .in("order_id", orderIds);

    if (!error) {
      const rows = Array.isArray(data) ? (data as OrderItemRow[]) : [];
      for (const row of rows) {
        const key = String(row.order_id ?? "");
        if (!key) continue;
        const list = result.get(key) ?? [];
        list.push(row);
        result.set(key, list);
      }
      return result;
    }

    if (!isMissingColumnError(error)) {
      throw new Error(error.message || "Could not load order items.");
    }
  }

  return result;
}

async function mapOrdersWithItemFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  rows: OrderSelectRow[]
): Promise<CustomerOrderStatusData[]> {
  if (rows.length === 0) return [];
  const needsFallback = rows.some((row) => !Array.isArray(row.order_items) || row.order_items.length === 0);
  if (!needsFallback) return rows.map(mapOrder);

  const orderIds = rows.map((row) => String(row.id ?? "")).filter((id) => id.length > 0);
  const itemMap = await fetchOrderItemsMap(supabase, orderIds);

  return rows.map((row) => {
    const key = String(row.id ?? "");
    const existingItems = Array.isArray(row.order_items) && row.order_items.length > 0 ? row.order_items : null;
    const fallbackItems = key ? itemMap.get(key) ?? null : null;
    return mapOrder({
      ...row,
      order_items: existingItems ?? fallbackItems ?? row.order_items,
    });
  });
}

export async function loadCustomerOrderStatuses(
  session: Pick<CustomerJwtPayload, "sub" | "username" | "email">
): Promise<CustomerOrderStatusData[]> {
  const supabase = getSupabaseServerClient();

  const resolvedUser = await resolveSessionUser(supabase, session);
  const appUserIdKey = resolvedUser ? userIdForDbQuery(resolvedUser.id) : null;
  const selectAttempts = [
    "id, order_number, created_at, status, payment_status, shipping_method, tracking_number, subtotal, shipping_fee, tax_amount, discount, total_amount, currency, notes, shipping_name, shipping_phone, shipping_address_line_1, shipping_address_line_2, shipping_city, shipping_state, shipping_postal_code, shipping_country, metadata, order_items(product_id, product_name, unit_price, quantity)",
    "id, order_number, created_at, status, payment_status, shipping_method, tracking_number, subtotal, shipping_fee, tax_amount, total_amount, currency, notes, shipping_name, shipping_phone, shipping_address_line_1, shipping_address_line_2, shipping_city, shipping_state, shipping_postal_code, shipping_country, metadata, order_items(product_id, product_name, unit_price, quantity)",
    "id, order_number, created_at, status, payment_status, shipping_method, tracking_number, subtotal, shipping_fee, tax_amount, total_amount, currency, metadata, order_items(product_id, product_name, unit_price, quantity)",
    // Fallback when PostgREST relationship orders -> order_items is missing
    "id, order_number, created_at, status, payment_status, shipping_method, tracking_number, subtotal, shipping_fee, tax_amount, discount, total_amount, currency, notes, shipping_name, shipping_phone, shipping_address_line_1, shipping_address_line_2, shipping_city, shipping_state, shipping_postal_code, shipping_country, metadata",
    "id, order_number, created_at, status, subtotal, shipping_fee, tax_amount, total_amount, currency, metadata",
    "id, created_at, status, total_amount, metadata, order_items(product_id, quantity)",
    "id, created_at, status, total_amount, metadata",
  ] as const;

  const fetchByUserId = async (userId: string | number): Promise<CustomerOrderStatusData[]> => {
    for (const select of selectAttempts) {
      const { data, error } = await supabase
        .from("orders")
        .select(select)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error) {
        const rows = Array.isArray(data) ? (data as OrderSelectRow[]) : [];
        return await mapOrdersWithItemFallback(supabase, rows);
      }

      if (isInvalidTypeFilterError(error)) {
        return [];
      }

      if (!isMissingColumnError(error)) {
        throw new Error(error.message || "Could not load customer order.");
      }
    }
    return [];
  };

  const fetchByCustomerMetadata = async (): Promise<CustomerOrderStatusData[]> => {
    const authSub = String(session.sub).trim();
    const email = String(session.email).trim();
    const username = String(session.username).trim();
    const publicUserId = resolvedUser ? String(resolvedUser.id).trim() : "";

    const runContainsQuery = async (
      select: string,
      customer: Record<string, unknown>
    ): Promise<OrderSelectRow[] | null> => {
      const { data, error } = await supabase
        .from("orders")
        .select(select)
        .contains("metadata", { customer })
        .order("created_at", { ascending: false });
      if (!error) {
        return Array.isArray(data) ? (data as OrderSelectRow[]) : [];
      }
      return null;
    };

    for (const select of selectAttempts) {
      // Preferred fallback: exact auth sub match (stable identity).
      if (authSub) {
        const rowsBySub = await runContainsQuery(select, { auth_sub: authSub });
        if (rowsBySub && rowsBySub.length > 0) return await mapOrdersWithItemFallback(supabase, rowsBySub);
      }

      if (publicUserId) {
        const rowsByPublicUserId = await runContainsQuery(select, { public_user_id: publicUserId });
        if (rowsByPublicUserId && rowsByPublicUserId.length > 0) return await mapOrdersWithItemFallback(supabase, rowsByPublicUserId);
      }

      // Secondary fallback: email match for legacy records.
      if (email) {
        const rowsByEmail = await runContainsQuery(select, { email });
        if (rowsByEmail && rowsByEmail.length > 0) return await mapOrdersWithItemFallback(supabase, rowsByEmail);
      }

      if (username) {
        const rowsByUsername = await runContainsQuery(select, { username });
        if (rowsByUsername && rowsByUsername.length > 0) return await mapOrdersWithItemFallback(supabase, rowsByUsername);
      }

      // Last fallback for PostgREST variants that don't support json contains well.
      const { data, error } = await supabase
        .from("orders")
        .select(select)
        .eq("metadata->customer->>email", email)
        .order("created_at", { ascending: false });
      if (!error) {
        const rows = Array.isArray(data) ? (data as OrderSelectRow[]) : [];
        if (rows.length > 0) return await mapOrdersWithItemFallback(supabase, rows);
      }
      if (error && !isMissingColumnError(error)) continue;
    }

    return [];
  };

  const idsToTry: Array<string | number> = [];
  const addId = (value: string | number | null | undefined) => {
    if (value == null) return;
    const key = String(value);
    if (!idsToTry.some((existing) => String(existing) === key)) {
      idsToTry.push(value);
    }
  };

  if (appUserIdKey) addId(appUserIdKey);

  const byEmail = await supabase
    .from("users")
    .select("id,email")
    .ilike("email", String(session.email).trim())
    .order("id", { ascending: false })
    .limit(1);
  if (!byEmail.error && Array.isArray(byEmail.data) && byEmail.data.length > 0 && byEmail.data[0]?.id) {
    addId(String(byEmail.data[0].id));
  }

  const orderMap = new Map<string, CustomerOrderStatusData>();
  for (const id of idsToTry) {
    const rows = await fetchByUserId(id);
    for (const row of rows) {
      if (!orderMap.has(row.id)) {
        orderMap.set(row.id, row);
      }
    }
  }

  if (orderMap.size > 0) {
    return Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const metadataOrders = await fetchByCustomerMetadata();
  if (metadataOrders.length > 0) {
    return metadataOrders;
  }

  return [];
}

export async function loadLatestCustomerOrderStatus(
  session: Pick<CustomerJwtPayload, "sub" | "username" | "email">
): Promise<CustomerOrderStatusData | null> {
  const orders = await loadCustomerOrderStatuses(session);
  return orders[0] ?? null;
}
