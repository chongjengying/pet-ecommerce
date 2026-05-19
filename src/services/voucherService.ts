import { getSupabaseServerClient } from "@/lib/supabaseServer";

export type VoucherDiscountType = "fixed" | "percentage" | "free_shipping";
export type VoucherErrorCode =
  | "VOUCHER_NOT_FOUND"
  | "VOUCHER_EXPIRED"
  | "VOUCHER_INACTIVE"
  | "MIN_SPEND_NOT_REACHED"
  | "USAGE_LIMIT_EXCEEDED"
  | "PER_USER_LIMIT_EXCEEDED"
  | "VOUCHER_NOT_APPLICABLE"
  | "VOUCHER_CANNOT_COMBINE";

export type VoucherValidationError = { code: VoucherErrorCode; message: string };
export type CartPricingInput = { subtotal: number; shipping: number; tax: number };
export type VoucherDTO = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: VoucherDiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount?: number | null;
  usage_limit?: number | null;
  used_count: number;
  per_user_limit?: number | null;
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
};

function asMoney(n: number): number { return Math.max(0, Number(n.toFixed(2))); }
function normalizeCode(code: string): string { return code.trim().toUpperCase(); }

export class VoucherService {
  static async fetchByCode(code: string): Promise<VoucherDTO | null> {
    const supabase = getSupabaseServerClient();
    const normalized = normalizeCode(code);
    const { data } = await supabase.from("vouchers").select("*").ilike("code", normalized).maybeSingle();
    if (!data) return null;
    return {
      id: String(data.id), code: String(data.code), name: String(data.name), description: data.description ?? null,
      discount_type: data.discount_type, discount_value: Number(data.discount_value ?? 0),
      max_discount_amount: data.max_discount_amount == null ? null : Number(data.max_discount_amount),
      min_order_amount: data.min_order_amount == null ? 0 : Number(data.min_order_amount),
      usage_limit: data.usage_limit == null ? null : Number(data.usage_limit),
      used_count: Number(data.used_count ?? 0), per_user_limit: data.per_user_limit == null ? null : Number(data.per_user_limit),
      is_active: Boolean(data.is_active), start_at: data.start_at ?? null, end_at: data.end_at ?? null,
    };
  }

  static calculateDiscount(voucher: VoucherDTO, pricing: CartPricingInput): number {
    const subtotal = Math.max(0, pricing.subtotal);
    if (voucher.discount_type === "free_shipping") return Math.min(Math.max(0, pricing.shipping), subtotal + pricing.shipping + pricing.tax);
    if (voucher.discount_type === "fixed") return Math.min(subtotal, asMoney(voucher.discount_value));
    const pct = Math.max(0, Math.min(100, voucher.discount_value));
    let discount = asMoney((subtotal * pct) / 100);
    if (voucher.max_discount_amount != null) discount = Math.min(discount, asMoney(voucher.max_discount_amount));
    return Math.min(subtotal, discount);
  }

  static async validateVoucher(params: { code: string; userId: string; pricing: CartPricingInput; paymentMethod?: string | null; hasOtherDiscount?: boolean }): Promise<{ voucher: VoucherDTO; discount: number } | { error: VoucherValidationError }> {
    const voucher = await this.fetchByCode(params.code);
    if (!voucher) return { error: { code: "VOUCHER_NOT_FOUND", message: "voucher not found" } };
    if (!voucher.is_active) return { error: { code: "VOUCHER_INACTIVE", message: "voucher inactive" } };
    const now = Date.now();
    if (voucher.start_at && now < Date.parse(voucher.start_at)) return { error: { code: "VOUCHER_INACTIVE", message: "voucher inactive" } };
    if (voucher.end_at && now > Date.parse(voucher.end_at)) return { error: { code: "VOUCHER_EXPIRED", message: "voucher expired" } };
    if (params.pricing.subtotal < Number(voucher.min_order_amount ?? 0)) return { error: { code: "MIN_SPEND_NOT_REACHED", message: "minimum spend not reached" } };
    if (voucher.usage_limit != null && voucher.used_count >= voucher.usage_limit) return { error: { code: "USAGE_LIMIT_EXCEEDED", message: "usage limit exceeded" } };
    if (params.hasOtherDiscount) return { error: { code: "VOUCHER_CANNOT_COMBINE", message: "voucher cannot be combined with other promotions" } };

    const supabase = getSupabaseServerClient();
    const { data: rules } = await supabase.from("voucher_rules").select("rule_type,operator,value").eq("voucher_id", Number(voucher.id));
    const paymentRules = (rules ?? []).filter((r) => r.rule_type === "payment_method");
    if (paymentRules.length > 0) {
      const method = String(params.paymentMethod ?? "").trim();
      const includes = paymentRules.filter((r) => r.operator === "include").map((r) => String(r.value));
      const excludes = paymentRules.filter((r) => r.operator === "exclude").map((r) => String(r.value));
      if (includes.length > 0 && !includes.includes(method)) return { error: { code: "VOUCHER_NOT_APPLICABLE", message: "voucher not applicable to cart items" } };
      if (excludes.includes(method)) return { error: { code: "VOUCHER_NOT_APPLICABLE", message: "voucher not applicable to cart items" } };
    }

    const { count } = await supabase.from("voucher_redemptions").select("id", { count: "exact", head: true }).eq("voucher_id", Number(voucher.id)).eq("user_id", params.userId).in("status", ["reserved", "used"]);
    if (voucher.per_user_limit != null && Number(count ?? 0) >= voucher.per_user_limit) return { error: { code: "PER_USER_LIMIT_EXCEEDED", message: "per-user limit exceeded" } };

    const discount = this.calculateDiscount(voucher, params.pricing);
    return { voucher, discount };
  }
}
