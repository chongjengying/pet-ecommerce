import { getSupabaseServerClient } from "@/lib/supabaseServer";

export interface OrderItemSnapshot {
  id: string | number;
  quantity: number;
  name: string;
  price: number;
}

export interface OrderRow {
  id: string;
  order_number: string | null;
  created_at: string;
  status: string;
  subtotal?: number;
  shipping_fee?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  inventory_log_count?: number;
  items: OrderItemSnapshot[];
}

/** Insert a new order: one row in orders (total_amount; user_id optional), then rows in order_items.
 *  Requires orders and order_items tables; run supabase-orders-table.sql.
 */
export async function createOrder(
  items: OrderItemSnapshot[],
  options?: {
    user_id?: string | number | null;
    status?: string;
    payment_status?: string;
    shipping_method?: string;
    tracking_number?: string | null;
    subtotal?: number;
    shipping_fee?: number;
    tax_amount?: number;
    discount?: number;
    currency?: string;
    notes?: string | null;
    shipping_name?: string | null;
    shipping_phone?: string | null;
    shipping_address_line_1?: string | null;
    shipping_address_line_2?: string | null;
    shipping_city?: string | null;
    shipping_state?: string | null;
    shipping_postal_code?: string | null;
    shipping_country?: string | null;
    payment_method_code?: string | null;
    payment_provider?: string | null;
    payment_snapshot?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }
): Promise<OrderRow> {
  const supabase = getSupabaseServerClient();
  const computedSubtotal = items.reduce(
    (sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 0),
    0
  );
  const subtotal = Number(options?.subtotal ?? computedSubtotal);
  const shippingFee = Number(options?.shipping_fee ?? 0);
  const taxAmount = Number(options?.tax_amount ?? 0);
  const total = subtotal + shippingFee + taxAmount;

  const orderPayload: {
    subtotal: number;
    shipping_fee: number;
    tax_amount: number;
    discount?: number;
    total_amount: number;
    currency: string;
    status: string;
    payment_status?: string;
    shipping_method?: string;
    tracking_number?: string | null;
    notes?: string | null;
    shipping_name?: string | null;
    shipping_phone?: string | null;
    shipping_address_line_1?: string | null;
    shipping_address_line_2?: string | null;
    shipping_city?: string | null;
    shipping_state?: string | null;
    shipping_postal_code?: string | null;
    shipping_country?: string | null;
    payment_method_code?: string | null;
    payment_provider?: string | null;
    payment_snapshot?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    user_id?: string | number;
  } = {
    subtotal,
    shipping_fee: shippingFee,
    tax_amount: taxAmount,
    total_amount: total,
    currency: options?.currency ?? "MYR",
    status: options?.status ?? "completed",
  };
  if (options?.payment_status != null) {
    orderPayload.payment_status = options.payment_status;
  }
  if (options?.shipping_method != null) {
    orderPayload.shipping_method = options.shipping_method;
  }
  if (options?.tracking_number !== undefined) {
    orderPayload.tracking_number = options.tracking_number;
  }
  if (options?.user_id != null && options.user_id !== "") {
    orderPayload.user_id = options.user_id;
  }
  if (options?.discount != null && Number.isFinite(Number(options.discount))) {
    orderPayload.discount = Number(options.discount);
  }
  if (options?.notes != null) {
    orderPayload.notes = options.notes;
  }
  if (options?.shipping_name !== undefined) {
    orderPayload.shipping_name = options.shipping_name;
  }
  if (options?.shipping_phone !== undefined) {
    orderPayload.shipping_phone = options.shipping_phone;
  }
  if (options?.shipping_address_line_1 !== undefined) {
    orderPayload.shipping_address_line_1 = options.shipping_address_line_1;
  }
  if (options?.shipping_address_line_2 !== undefined) {
    orderPayload.shipping_address_line_2 = options.shipping_address_line_2;
  }
  if (options?.shipping_city !== undefined) {
    orderPayload.shipping_city = options.shipping_city;
  }
  if (options?.shipping_state !== undefined) {
    orderPayload.shipping_state = options.shipping_state;
  }
  if (options?.shipping_postal_code !== undefined) {
    orderPayload.shipping_postal_code = options.shipping_postal_code;
  }
  if (options?.shipping_country !== undefined) {
    orderPayload.shipping_country = options.shipping_country;
  }
  if (options?.payment_method_code !== undefined) {
    orderPayload.payment_method_code = options.payment_method_code;
  }
  if (options?.payment_provider !== undefined) {
    orderPayload.payment_provider = options.payment_provider;
  }
  if (options?.payment_snapshot !== undefined) {
    orderPayload.payment_snapshot = options.payment_snapshot;
  }
  if (options?.metadata != null) {
    orderPayload.metadata = options.metadata;
  }

  // Backward-compatible insert for environments where some newer columns
  // (e.g. metadata, notes) are not yet present in Supabase schema cache.
  const insertPayload: Record<string, unknown> = { ...orderPayload };
  type InsertedOrder = {
    id: string;
    order_number?: string | null;
    created_at: string;
    status: string;
    subtotal?: number;
    shipping_fee?: number;
    tax_amount?: number;
    total_amount?: number;
    currency?: string;
  };
  let order: InsertedOrder | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select()
      .single();

    if (!error) {
      order = data as InsertedOrder;
      break;
    }

    const message =
      typeof error.message === "string"
        ? error.message
        : (error as { message?: string }).message ?? JSON.stringify(error);

    const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i);
    const missingColumn = missingColumnMatch?.[1];
    if (!missingColumn || !(missingColumn in insertPayload)) {
      throw new Error(message);
    }
    delete insertPayload[missingColumn];
  }

  if (!order) {
    throw new Error("Could not create order due to schema mismatch.");
  }

  const orderItems = items.map((item) => {
    const pid = item.id;
    const productId =
      typeof pid === "number" && Number.isInteger(pid)
        ? pid
        : typeof pid === "string" && /^\d+$/.test(pid)
          ? Number(pid)
          : null;
    return {
      order_id: order.id,
      product_id: productId,
      product_name: item.name ?? "Product",
      quantity: item.quantity,
      unit_price: Number(item.price) || 0,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    const message =
      typeof itemsError.message === "string"
        ? itemsError.message
        : (itemsError as { message?: string }).message ?? JSON.stringify(itemsError);
    throw new Error(message);
  }

  return {
    id: order.id,
    order_number: order.order_number ?? null,
    created_at: order.created_at,
    status: order.status,
    subtotal: Number(order.subtotal),
    shipping_fee: Number(order.shipping_fee),
    tax_amount: Number(order.tax_amount),
    total_amount: Number(order.total_amount),
    currency: order.currency ?? "MYR",
    items,
  };
}

type OrderItemRow = {
  product_id: number | null;
  quantity: number;
  unit_price?: number | null;
  product_name?: string | null;
  price?: number | null;
  name?: string | null;
};

type OrderSelectRow = Omit<OrderRow, "items"> & {
  order_items?: OrderItemRow[];
};

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (value != null && typeof value === "object" && "message" in value && typeof (value as { message: unknown }).message === "string") {
    return new Error((value as { message: string }).message);
  }
  return new Error(typeof value === "string" ? value : "Failed to load orders");
}

function isMissingColumnError(err: unknown): boolean {
  const msg = toError(err).message.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the") ||
    msg.includes("schema cache")
  );
}

/** Fetch orders with line items from order_items. */
export async function getOrders(): Promise<OrderRow[]> {
  const supabase = getSupabaseServerClient();
  const selectAttempts = [
    // New schema (preferred)
    "id, order_number, created_at, status, subtotal, shipping_fee, tax_amount, total_amount, currency, order_items(product_id, product_name, unit_price, quantity)",
    // Older schema: orders pricing fields missing, but order_items has product_name/unit_price
    "id, order_number, created_at, status, total_amount, currency, order_items(product_id, product_name, unit_price, quantity)",
    // Older schema: order_items doesn't have product_name/unit_price either (we'll resolve product name from products table)
    "id, order_number, created_at, status, total_amount, currency, order_items(product_id, quantity)",
    // Very old: orders has no order_number/currency; only ids, timestamps, status, items
    "id, created_at, status, total_amount, order_items(product_id, quantity)",
  ] as const;

  let lastError: unknown = null;
  for (const select of selectAttempts) {
    const { data, error } = await supabase
      .from("orders")
      .select(select)
      .order("created_at", { ascending: false });

    if (!error) {
      return await mapRowsToOrders(supabase, (data ?? []) as unknown as OrderSelectRow[]);
    }

    lastError = error;
    if (!isMissingColumnError(error)) {
      throw toError(error);
    }
  }

  throw toError(lastError);
}

async function mapRowsToOrders(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  rows: OrderSelectRow[]
): Promise<OrderRow[]> {
  const orderIds = rows.map((row) => row.id);
  const productIds = new Set<number>();
  for (const order of rows) {
    const orderItems = order.order_items;
    if (Array.isArray(orderItems)) {
      for (const row of orderItems) {
        const id = row.product_id;
        if (id != null && Number.isFinite(Number(id))) productIds.add(Number(id));
      }
    }
  }

  const productNameMap = new Map<number, string>();
  if (productIds.size > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .in("id", [...productIds]);
    if (Array.isArray(products)) {
      for (const p of products) {
        if (p?.id != null && p?.name != null) productNameMap.set(Number(p.id), String(p.name));
      }
    }
  }

  const inventoryLogCountMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: logRows } = await supabase
      .from("inventory_logs")
      .select("order_id")
      .in("order_id", orderIds);

    if (Array.isArray(logRows)) {
      for (const row of logRows as Array<{ order_id?: string | null }>) {
        if (!row?.order_id) continue;
        const prev = inventoryLogCountMap.get(row.order_id) ?? 0;
        inventoryLogCountMap.set(row.order_id, prev + 1);
      }
    }
  }

  return rows.map((order) => {
    const orderItems = order.order_items;
    const items: OrderItemSnapshot[] =
      Array.isArray(orderItems) && orderItems.length > 0
        ? orderItems.map((row) => ({
            id: row.product_id ?? 0,
            quantity: row.quantity,
            name:
              row.product_name ??
              row.name ??
              productNameMap.get(Number(row.product_id)) ??
              "Product",
            price: Number(row.unit_price ?? row.price ?? 0),
          }))
        : [];
    const rest = Object.fromEntries(
      Object.entries(order).filter(([key]) => key !== "order_items")
    ) as Omit<OrderSelectRow, "order_items">;
    return {
      ...rest,
      subtotal:
        rest.subtotal != null && Number.isFinite(Number(rest.subtotal))
          ? Number(rest.subtotal)
          : items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      shipping_fee:
        rest.shipping_fee != null && Number.isFinite(Number(rest.shipping_fee))
          ? Number(rest.shipping_fee)
          : 0,
      tax_amount:
        rest.tax_amount != null && Number.isFinite(Number(rest.tax_amount))
          ? Number(rest.tax_amount)
          : 0,
      total_amount:
        rest.total_amount != null && Number.isFinite(Number(rest.total_amount))
          ? Number(rest.total_amount)
          : items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      currency: rest.currency ?? "MYR",
      inventory_log_count: inventoryLogCountMap.get(order.id) ?? 0,
      items,
    };
  });
}
