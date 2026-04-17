import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import { getServerWriteClient } from "@/lib/adminProductMutations";

const ROLE_VALUES = new Set(["admin", "customer"]);
const STATUS_VALUES = new Set(["active", "inactive", "suspended", "deleted"]);

async function updateUserSafely(id: string, payload: Record<string, unknown>) {
  const db = getServerWriteClient();
  const body: Record<string, unknown> = { ...payload };

  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await db.from("users").update(body).eq("id", id).select("id").single();
    if (!error) return;
    const message = typeof error.message === "string" ? error.message : "Could not update user.";
    const missing = message.match(/Could not find the '([^']+)' column/i)?.[1];
    if (!missing || !(missing in body)) throw new Error(message);
    delete body[missing];
  }

  throw new Error("Could not update user due to schema mismatch.");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Missing user id." }, { status: 400 });

    const body = (await request.json()) as {
      email?: string;
      username?: string;
      password?: string;
      role?: string;
      status?: string;
    };

    const updatePayload: Record<string, unknown> = {};
    if (typeof body.email === "string" && body.email.trim()) updatePayload.email = body.email.trim().toLowerCase();
    if (typeof body.username === "string" && body.username.trim()) updatePayload.username = body.username.trim();
    if (typeof body.password === "string" && body.password.trim()) updatePayload.password = body.password;
    if (typeof body.role === "string" && body.role.trim()) {
      const role = body.role.trim().toLowerCase();
      if (!ROLE_VALUES.has(role)) {
        return NextResponse.json({ error: "Role must be admin or customer." }, { status: 400 });
      }
      updatePayload.role = role;
    }
    if (typeof body.status === "string" && body.status.trim()) {
      const status = body.status.trim().toLowerCase();
      if (!STATUS_VALUES.has(status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      updatePayload.status = status;
      updatePayload.account_status = status;
      updatePayload.is_active = status === "active" || status === "inactive";
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await updateUserSafely(id, updatePayload);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Missing user id." }, { status: 400 });
    await updateUserSafely(id, {
      status: "deleted",
      account_status: "deleted",
      is_active: false,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

