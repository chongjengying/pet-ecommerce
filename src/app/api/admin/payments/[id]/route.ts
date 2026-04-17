import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import { updatePaymentReview } from "@/services/paymentService";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Missing payment id." }, { status: 400 });

    const body = (await request.json()) as {
      review_status?: string;
      notes?: string | null;
    };
    const review_status = String(body.review_status ?? "").trim().toLowerCase();
    if (!["pending", "approved", "rejected"].includes(review_status)) {
      return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
    }

    const updated = await updatePaymentReview(id, {
      review_status,
      notes: body.notes ?? null,
      reviewed_by: gate.userId,
    });

    return NextResponse.json({ success: true, payment: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

