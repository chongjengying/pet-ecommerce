import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET() {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("vouchers").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ vouchers: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseServerClient();
  const payload = {
    code: String(body.code ?? "").trim().toUpperCase(),
    name: String(body.name ?? "").trim(),
    description: body.description ? String(body.description) : null,
    discount_type: body.discount_type,
    discount_value: Number(body.discount_value ?? 0),
    max_discount_amount: body.max_discount_amount == null || body.max_discount_amount === "" ? null : Number(body.max_discount_amount),
    min_order_amount: Number(body.min_order_amount ?? 0),
    start_at: body.start_at || null,
    end_at: body.end_at || null,
    usage_limit: body.usage_limit == null || body.usage_limit === "" ? null : Number(body.usage_limit),
    per_user_limit: body.per_user_limit == null || body.per_user_limit === "" ? null : Number(body.per_user_limit),
    is_active: Boolean(body.is_active ?? true),
  };
  const { data, error } = await supabase.from("vouchers").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, voucher: data });
}
