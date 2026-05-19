import { NextResponse } from "next/server";

type PasswordResetRequestBody = {
  identifier?: unknown;
};

export async function POST(request: Request) {
  let body: PasswordResetRequestBody;
  try {
    body = (await request.json()) as PasswordResetRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim().toLowerCase();
  if (!identifier) {
    return NextResponse.json({ error: "Email, username, or phone is required." }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "If an account exists, we sent a reset OTP or link to your email/phone.",
  });
}
