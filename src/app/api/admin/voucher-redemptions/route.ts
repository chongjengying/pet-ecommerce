import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET() {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("voucher_redemptions")
    .select("id,voucher_id,voucher_code,user_id,order_id,discount_amount,status,used_at,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ redemptions: data ?? [] });
}
