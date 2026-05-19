import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("vouchers").update(body).eq("id", Number(id)).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, voucher: data });
}
