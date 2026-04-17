import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import { getPayments } from "@/services/paymentService";

export async function GET() {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const payments = await getPayments(500);
    return NextResponse.json({ success: true, payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

