import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface PaymentRow {
  id: string;
  order_id: string;
  user_id: string | number | null;
  transaction_id: string | null;
  reference_no: string | null;
  payment_method: string | null;
  provider: string | null;
  amount: number;
  currency: string;
  refund_amount: number;
  status: string;
  failure_reason: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  review_status: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  gateway_response: Record<string, unknown> | null;
  receipt_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

type CreatePaymentInput = {
  order_id: string;
  user_id?: string | number | null;
  transaction_id?: string | null;
  reference_no?: string | null;
  payment_method?: string | null;
  provider?: string | null;
  amount: number;
  currency?: string | null;
  refund_amount?: number | null;
  status?: PaymentStatus | string | null;
  failure_reason?: string | null;
  paid_at?: string | null;
  refunded_at?: string | null;
  review_status?: ReviewStatus | string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  notes?: string | null;
  gateway_response?: Record<string, unknown> | null;
  receipt_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizePaymentRow(row: Record<string, unknown>): PaymentRow {
  return {
    id: String(row.id ?? ""),
    order_id: String(row.order_id ?? ""),
    user_id: (row.user_id as string | number | null) ?? null,
    transaction_id: typeof row.transaction_id === "string" ? row.transaction_id : null,
    reference_no: typeof row.reference_no === "string" ? row.reference_no : null,
    payment_method: typeof row.payment_method === "string" ? row.payment_method : null,
    provider: typeof row.provider === "string" ? row.provider : null,
    amount: Number(row.amount ?? 0),
    currency: typeof row.currency === "string" ? row.currency : "MYR",
    refund_amount: Number(row.refund_amount ?? 0),
    status: typeof row.status === "string" ? row.status : "pending",
    failure_reason: typeof row.failure_reason === "string" ? row.failure_reason : null,
    paid_at: typeof row.paid_at === "string" ? row.paid_at : null,
    refunded_at: typeof row.refunded_at === "string" ? row.refunded_at : null,
    review_status: typeof row.review_status === "string" ? row.review_status : null,
    reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    gateway_response:
      row.gateway_response && typeof row.gateway_response === "object"
        ? (row.gateway_response as Record<string, unknown>)
        : null,
    receipt_url: typeof row.receipt_url === "string" ? row.receipt_url : null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function safeMessage(error: unknown, fallback: string) {
  return typeof (error as { message?: unknown })?.message === "string"
    ? ((error as { message: string }).message || fallback)
    : fallback;
}

function isMissingColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("column") && (m.includes("does not exist") || m.includes("could not find"));
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentRow | null> {
  const supabase = getSupabaseServerClient();
  const payload: Record<string, unknown> = {
    order_id: input.order_id,
    user_id: input.user_id ?? null,
    transaction_id: input.transaction_id ?? null,
    reference_no: input.reference_no ?? null,
    payment_method: input.payment_method ?? null,
    provider: input.provider ?? null,
    amount: Number(input.amount ?? 0),
    currency: input.currency ?? "MYR",
    refund_amount: Number(input.refund_amount ?? 0),
    status: input.status ?? "paid",
    failure_reason: input.failure_reason ?? null,
    paid_at: input.paid_at ?? new Date().toISOString(),
    refunded_at: input.refunded_at ?? null,
    review_status: input.review_status ?? "pending",
    reviewed_by: input.reviewed_by ?? null,
    reviewed_at: input.reviewed_at ?? null,
    notes: input.notes ?? null,
    gateway_response: input.gateway_response ?? null,
    receipt_url: input.receipt_url ?? null,
    metadata: input.metadata ?? null,
  };

  for (let attempt = 0; attempt < 24; attempt++) {
    const { data, error } = await supabase.from("payments").insert(payload).select("*").single();
    if (!error && data) {
      return normalizePaymentRow(data as Record<string, unknown>);
    }
    const message = safeMessage(error, "Could not create payment.");
    const missingColumn = message.match(/Could not find the '([^']+)' column/i)?.[1];
    if (!missingColumn || !(missingColumn in payload) || !isMissingColumnError(message)) {
      throw new Error(message);
    }
    delete payload[missingColumn];
  }

  throw new Error("Could not create payment due to schema mismatch.");
}

export async function getPayments(limit = 200): Promise<PaymentRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(safeMessage(error, "Could not load payments."));
  }
  return Array.isArray(data) ? data.map((row) => normalizePaymentRow(row as Record<string, unknown>)) : [];
}

export async function getPaymentsByOrderIds(orderIds: string[]): Promise<Map<string, PaymentRow>> {
  const supabase = getSupabaseServerClient();
  const map = new Map<string, PaymentRow>();
  if (orderIds.length === 0) return map;
  const { data, error } = await supabase.from("payments").select("*").in("order_id", orderIds);
  if (error) {
    throw new Error(safeMessage(error, "Could not load payments by order."));
  }
  for (const row of Array.isArray(data) ? data : []) {
    const payment = normalizePaymentRow(row as Record<string, unknown>);
    if (!map.has(payment.order_id)) {
      map.set(payment.order_id, payment);
    }
  }
  return map;
}

export async function updatePaymentReview(
  id: string,
  update: { review_status?: ReviewStatus | string; notes?: string | null; reviewed_by?: string | null }
) {
  const supabase = getSupabaseServerClient();
  const payload: Record<string, unknown> = {};
  if (update.review_status) payload.review_status = update.review_status;
  if (update.notes !== undefined) payload.notes = update.notes;
  if (update.reviewed_by !== undefined) payload.reviewed_by = update.reviewed_by;
  payload.reviewed_at = new Date().toISOString();

  const { data, error } = await supabase.from("payments").update(payload).eq("id", id).select("*").single();
  if (error || !data) {
    throw new Error(safeMessage(error, "Could not update payment review."));
  }
  return normalizePaymentRow(data as Record<string, unknown>);
}

