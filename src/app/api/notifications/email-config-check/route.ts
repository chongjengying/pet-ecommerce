import { NextResponse } from "next/server";

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskKey(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return `${"*".repeat(value.length)}`;
  return `${value.slice(0, 4)}${"*".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

export async function GET(request: Request) {
  const expectedSecret = process.env.EMAIL_NOTIFICATION_SECRET;
  if (expectedSecret) {
    const provided = request.headers.get("x-email-notification-secret") ?? "";
    if (!provided || provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const resendApiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const fromEmail = String(process.env.CHECKOUT_EMAIL_FROM ?? process.env.EMAIL_FROM ?? "").trim();
  const fromName = String(process.env.CHECKOUT_EMAIL_FROM_NAME ?? "Pawluxe").trim();

  const warnings: string[] = [];
  if (!resendApiKey) warnings.push("RESEND_API_KEY is missing.");
  if (!fromEmail) warnings.push("CHECKOUT_EMAIL_FROM/EMAIL_FROM is missing.");
  if (fromEmail && !isLikelyEmail(fromEmail)) warnings.push("From email format looks invalid.");
  if (resendApiKey && !resendApiKey.startsWith("re_")) {
    warnings.push("RESEND_API_KEY does not start with 're_' (verify key value).");
  }

  return NextResponse.json({
    ok: warnings.length === 0,
    provider: "resend",
    ready_for_checkout_email: warnings.length === 0,
    config: {
      has_resend_api_key: Boolean(resendApiKey),
      resend_api_key_masked: resendApiKey ? maskKey(resendApiKey) : null,
      has_from_email: Boolean(fromEmail),
      from_email: fromEmail || null,
      from_name: fromName,
      has_notification_secret: Boolean(expectedSecret),
    },
    warnings,
    next_step:
      warnings.length === 0
        ? "Config looks good. You can test POST /api/notifications/checkout-email."
        : "Fix warnings, restart server, then run this check again.",
  });
}

