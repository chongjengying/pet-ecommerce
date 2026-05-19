import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCartView } from "@/lib/cartDb";
import { userIdForDbQuery } from "@/lib/userIdDb";
import { VoucherService } from "@/services/voucherService";
import { resolveSessionUser } from "@/lib/customerProfile";

const FREE_SHIPPING_THRESHOLD = 150;
const FLAT_SHIPPING_FEE = 12;

export async function POST(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "Please sign in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const code = String(body?.code ?? "").trim();
  if (!code) return NextResponse.json({ success: false, error_code: "INVALID_CODE", message: "Voucher code is required." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  const resolvedUser = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolvedUser) {
    return NextResponse.json({ success: false, error_code: "USER_NOT_FOUND", message: "Profile not found." }, { status: 404 });
  }
  const cartResult = await getCartView(supabase, userIdForDbQuery(resolvedUser.id));
  const items = cartResult.data?.items ?? [];
  const subtotal = items.reduce((s, i) => s + Number(i.price_at_time ?? 0) * Number(i.quantity ?? 1), 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : (items.length > 0 ? FLAT_SHIPPING_FEE : 0);
  const tax = 0;

  const validated = await VoucherService.validateVoucher({ code, userId: String(resolvedUser.id), pricing: { subtotal, shipping, tax } });
  if ("error" in validated) {
    return NextResponse.json({ success: false, error_code: validated.error.code, message: validated.error.message }, { status: 400 });
  }

  const total = Math.max(0, Number((subtotal + shipping + tax - validated.discount).toFixed(2)));
  return NextResponse.json({ success: true, voucher: { id: validated.voucher.id, code: validated.voucher.code, discount_type: validated.voucher.discount_type, discount_value: validated.voucher.discount_value }, pricing: { subtotal, shipping, tax, voucher_discount: validated.discount, total } });
}
