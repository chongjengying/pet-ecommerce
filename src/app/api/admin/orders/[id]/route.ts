import { NextResponse } from "next/server";
import { getServerWriteClient } from "@/lib/adminProductMutations";

const allowedStatuses = new Set(["pending", "paid", "shipped"]);

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing order id." }, { status: 400 });
    }

    const body = (await request.json()) as { status?: string };
    const status = String(body?.status ?? "").trim().toLowerCase();
    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: "Invalid status. Use pending, paid, or shipped." },
        { status: 400 }
      );
    }

    const db = getServerWriteClient();
    const { data, error } = await db
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select("id,status")
      .single();

    if (error) {
      const message = typeof error.message === "string" ? error.message : "Failed to update order.";
      throw new Error(message);
    }

    return NextResponse.json({ success: true, order: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
