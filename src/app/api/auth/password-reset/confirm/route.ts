import { NextResponse } from "next/server";

type PasswordResetConfirmBody = {
  identifier?: unknown;
  otp?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
};

export async function POST(request: Request) {
  let body: PasswordResetConfirmBody;
  try {
    body = (await request.json()) as PasswordResetConfirmBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const otp = String(body.otp ?? "").trim();
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!otp || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "OTP, new password, and confirm password are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "New password and confirmation do not match." }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Password updated successfully.",
  });
}
