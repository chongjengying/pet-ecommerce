import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { resolveSessionUser } from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";

type ChangePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
};

function safeEqualPassword(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth API is not configured." },
      { status: 503 }
    );
  }

  let body: ChangePasswordBody;
  try {
    body = (await request.json()) as ChangePasswordBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "Current, new, and confirm password are required." }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "New password and confirmation do not match." }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "New password must be different from current password." }, { status: 400 });
  }

  const resolvedUser = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolvedUser) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const userId = userIdForDbQuery(resolvedUser.id);
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("password")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    return NextResponse.json({ error: userError.message || "Could not verify current password." }, { status: 400 });
  }
  if (!userRow) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const savedPassword = String((userRow as { password?: unknown }).password ?? "");
  if (!safeEqualPassword(currentPassword, savedPassword)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ password: newPassword })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "Could not update password." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
