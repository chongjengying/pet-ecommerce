type CheckoutEmailItem = {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type CheckoutEmailPayload = {
  to_email: string;
  to_name?: string | null;
  order_number?: string | null;
  currency?: string | null;
  subtotal?: number;
  shipping_fee?: number;
  tax_amount?: number;
  total_amount?: number;
  items?: CheckoutEmailItem[];
};

type SendEmailResult = {
  sent: boolean;
  provider: "resend";
  id?: string;
  error?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildEmailContent(payload: CheckoutEmailPayload) {
  const currency = String(payload.currency ?? "MYR");
  const orderNumber = payload.order_number ? String(payload.order_number) : null;
  const customerName = payload.to_name ? String(payload.to_name).trim() : "";
  const items = Array.isArray(payload.items) ? payload.items : [];
  const subtotal = toMoney(payload.subtotal);
  const shipping = toMoney(payload.shipping_fee);
  const tax = toMoney(payload.tax_amount);
  const total = toMoney(payload.total_amount);

  const itemRowsHtml = items
    .map((item) => {
      const name = escapeHtml(String(item.name ?? "Product"));
      const qty = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
      const line = toMoney(item.line_total);
      return `<tr><td style="padding:6px 0">${name} x${qty}</td><td style="padding:6px 0;text-align:right">${currency} ${line.toFixed(2)}</td></tr>`;
    })
    .join("");

  const greeting = customerName ? `Hi ${escapeHtml(customerName)},` : "Hi,";
  const subject = orderNumber
    ? `Order Confirmation - ${orderNumber}`
    : "Order Confirmation";

  const textLines = [
    greeting,
    "",
    "Thanks for your order. Your checkout is confirmed.",
    orderNumber ? `Order number: ${orderNumber}` : null,
    "",
    "Items:",
    ...items.map(
      (item) =>
        `- ${item.name} x${Math.max(1, Math.floor(Number(item.quantity ?? 1)))}: ${currency} ${toMoney(item.line_total).toFixed(2)}`
    ),
    "",
    `Subtotal: ${currency} ${subtotal.toFixed(2)}`,
    `Shipping: ${currency} ${shipping.toFixed(2)}`,
    `Tax: ${currency} ${tax.toFixed(2)}`,
    `Total: ${currency} ${total.toFixed(2)}`,
    "",
    "Thank you for shopping with us.",
  ].filter((line): line is string => line != null);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>${greeting}</p>
      <p>Thanks for your order. Your checkout is confirmed.</p>
      ${orderNumber ? `<p><strong>Order number:</strong> ${escapeHtml(orderNumber)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;margin-top:8px">
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0" />
      <p style="margin:4px 0">Subtotal: ${currency} ${subtotal.toFixed(2)}</p>
      <p style="margin:4px 0">Shipping: ${currency} ${shipping.toFixed(2)}</p>
      <p style="margin:4px 0">Tax: ${currency} ${tax.toFixed(2)}</p>
      <p style="margin:8px 0 0 0"><strong>Total: ${currency} ${total.toFixed(2)}</strong></p>
      <p style="margin-top:16px">Thank you for shopping with us.</p>
    </div>
  `.trim();

  return {
    subject,
    text: textLines.join("\n"),
    html,
  };
}

export async function sendCheckoutEmailNotification(
  payload: CheckoutEmailPayload
): Promise<SendEmailResult> {
  const toEmail = String(payload.to_email ?? "").trim();
  if (!toEmail) {
    return { sent: false, provider: "resend", error: "Missing to_email." };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CHECKOUT_EMAIL_FROM ?? process.env.EMAIL_FROM;
  const fromName = process.env.CHECKOUT_EMAIL_FROM_NAME ?? "Pawluxe";
  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      provider: "resend",
      error: "Missing RESEND_API_KEY or CHECKOUT_EMAIL_FROM/EMAIL_FROM.",
    };
  }

  const from = `${fromName} <${fromEmail}>`;
  const content = buildEmailContent(payload);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        `Resend request failed (${response.status}).`;
      return { sent: false, provider: "resend", error: message };
    }

    return { sent: true, provider: "resend", id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sent: false, provider: "resend", error: message };
  }
}

