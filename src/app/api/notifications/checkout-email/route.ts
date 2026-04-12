import { NextResponse } from "next/server";
import { sendCheckoutEmailNotification } from "@/lib/emailNotifications";

type RequestBody = {
  to_email?: unknown;
  to_name?: unknown;
  order_number?: unknown;
  currency?: unknown;
  subtotal?: unknown;
  shipping_fee?: unknown;
  tax_amount?: unknown;
  total_amount?: unknown;
  items?: unknown;
};

function parseNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.EMAIL_NOTIFICATION_SECRET;
  if (expectedSecret) {
    const provided = request.headers.get("x-email-notification-secret") ?? "";
    if (!provided || provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const items = Array.isArray(body.items)
    ? body.items.map((entry) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        return {
          name: String(row.name ?? "Product"),
          quantity: Math.max(1, Math.floor(Number(row.quantity ?? 1))),
          unit_price: parseNumber(row.unit_price),
          line_total: parseNumber(row.line_total),
        };
      })
    : [];

  const result = await sendCheckoutEmailNotification({
    to_email: String(body.to_email ?? "").trim(),
    to_name: body.to_name == null ? null : String(body.to_name),
    order_number: body.order_number == null ? null : String(body.order_number),
    currency: body.currency == null ? "MYR" : String(body.currency),
    subtotal: parseNumber(body.subtotal),
    shipping_fee: parseNumber(body.shipping_fee),
    tax_amount: parseNumber(body.tax_amount),
    total_amount: parseNumber(body.total_amount),
    items,
  });

  if (!result.sent) {
    return NextResponse.json(
      {
        ok: false,
        provider: result.provider,
        error: result.error ?? "Email send failed.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    id: result.id ?? null,
  });
}

