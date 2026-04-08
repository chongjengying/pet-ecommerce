"use client";

import { useMemo, useState } from "react";
import type { CustomerOrderStatusData } from "@/lib/customerOrders";

type OrderStatusClientProps = {
  order: CustomerOrderStatusData | null;
};

type ActionState = "idle" | "tracking" | "invoice" | "cancel" | "support";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending confirmation",
  processing: "Preparing your parcel",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_BADGES: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  processing: "border-sky-200 bg-sky-50 text-sky-900",
  packed: "border-indigo-200 bg-indigo-50 text-indigo-900",
  shipped: "border-blue-200 bg-blue-50 text-blue-900",
  out_for_delivery: "border-violet-200 bg-violet-50 text-violet-900",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-900",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  cancelled: "border-rose-200 bg-rose-50 text-rose-900",
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function statusBadge(status: string): string {
  return STATUS_BADGES[status] ?? "border-stone-200 bg-stone-50 text-stone-900";
}

function buildProgress(order: CustomerOrderStatusData | null) {
  const steps = [
    { key: "pending", label: "Order placed", hint: "We have received your order." },
    { key: "processing", label: "Packed", hint: "Items are being prepared for shipment." },
    { key: "shipped", label: "On the way", hint: "Your parcel is with the courier." },
    { key: "delivered", label: "Delivered", hint: "Order arrived at your doorstep." },
  ];

  if (!order) {
    return steps.map((step, index) => ({ ...step, state: index === 0 ? "current" : "upcoming" }));
  }

  if (order.status === "cancelled") {
    return steps.map((step, index) => ({ ...step, state: index === 0 ? "complete" : "upcoming" }));
  }

  const statusOrder = ["pending", "processing", "packed", "shipped", "out_for_delivery", "delivered", "completed"];
  const currentRank = Math.max(0, statusOrder.indexOf(order.status));
  const mappedRank = [0, 2, 4, 6];

  return steps.map((step, index) => {
    const stepRank = mappedRank[index];
    if (currentRank > stepRank) return { ...step, state: "complete" };
    if (currentRank === stepRank || (index === 1 && order.status === "packed") || (index === 2 && order.status === "out_for_delivery")) {
      return { ...step, state: "current" };
    }
    return { ...step, state: "upcoming" };
  });
}

function detailLine(values: Array<string | null | undefined>): string {
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(", ");
}

function ActionButton({
  label,
  tone,
  busy,
  onClick,
}: {
  label: string;
  tone: "primary" | "secondary" | "danger";
  busy: boolean;
  onClick: () => void;
}) {
  const tones = {
    primary: "bg-umber text-white hover:bg-umber/90",
    secondary: "border border-amber-200/90 bg-white text-umber hover:bg-amber-50",
    danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
    >
      {busy ? "Working..." : label}
    </button>
  );
}

export default function OrderStatusClient({ order }: OrderStatusClientProps) {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);

  const progress = useMemo(() => buildProgress(order), [order]);

  const runAction = (action: Exclude<ActionState, "idle">, message: string) => {
    setActionState(action);
    setFeedback(message);
    window.setTimeout(() => setActionState("idle"), 500);
  };

  if (!order) {
    return (
      <div className="overflow-hidden rounded-[32px] border border-amber-200/70 bg-white shadow-[0_18px_60px_rgba(44,36,32,0.08)]">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(120,146,111,0.18),_transparent_34%),linear-gradient(135deg,rgba(255,255,255,1),rgba(248,242,229,0.92),rgba(255,249,240,0.92))] px-6 py-10 sm:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-umber/45">Order status</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-umber">No orders yet</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-umber/68">
            Your next checkout will appear here with live delivery progress, payment details, and downloadable invoice access.
          </p>
          <div className="mt-8 rounded-3xl border border-amber-100/80 bg-white/90 p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              {progress.map((step) => (
                <div key={step.key} className="rounded-2xl border border-dashed border-amber-200/80 bg-cream/50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-umber/45">{step.label}</p>
                  <p className="mt-2 text-sm text-umber/70">{step.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shippingLine = detailLine([
    order.shipping.addressLine1,
    order.shipping.addressLine2,
    order.shipping.city,
    order.shipping.state,
    order.shipping.postalCode,
    order.shipping.country,
  ]);

  return (
    <div className="overflow-hidden rounded-[32px] border border-amber-200/70 bg-white shadow-[0_18px_60px_rgba(44,36,32,0.08)]">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(120,146,111,0.18),_transparent_32%),linear-gradient(135deg,rgba(255,255,255,1),rgba(247,242,232,0.96),rgba(255,250,242,0.95))] px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-umber/45">Order status</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-umber sm:text-4xl">{order.orderNumber}</h1>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(order.status)}`}>
                {formatStatus(order.status)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-umber/68">
              Ordered on {formatDate(order.createdAt)}. We keep your shipment, payment, and parcel progress in one place so you can track everything quickly.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:w-[28rem]">
            <div className="rounded-3xl border border-white/70 bg-white/92 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Order total</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-umber">{formatCurrency(order.totalAmount, order.currency)}</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/92 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Items</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-umber">{order.items.length}</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/92 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Courier</p>
              <p className="mt-3 text-lg font-semibold tracking-tight text-umber">{order.shipping.courier ?? "Assigned soon"}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-umber">Delivery progress</p>
              <p className="mt-1 text-sm text-umber/62">
                {order.shipping.etaLabel
                  ? `Estimated arrival: ${order.shipping.etaLabel}`
                  : "Delivery updates will appear here as your parcel moves."}
              </p>
            </div>
            {order.shipping.trackingNumber ? (
              <div className="rounded-2xl border border-amber-200/80 bg-cream/50 px-4 py-3 text-sm text-umber/78">
                Tracking no. <span className="font-semibold text-umber">{order.shipping.trackingNumber}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {progress.map((step, index) => {
              const stateClasses =
                step.state === "complete"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : step.state === "current"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-stone-200 bg-stone-50 text-stone-500";

              return (
                <div key={step.key} className="relative">
                  {index < progress.length - 1 ? (
                    <span className="absolute left-7 top-7 hidden h-px w-[calc(100%-1rem)] bg-amber-200 md:block" aria-hidden="true" />
                  ) : null}
                  <div className={`relative rounded-3xl border px-4 py-4 ${stateClasses}`}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20 bg-white/80 text-sm font-semibold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{step.label}</p>
                        <p className="mt-1 text-xs opacity-80">{step.hint}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-8 sm:px-10 sm:py-10">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-amber-100/90 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-umber">Purchased items</p>
                  <p className="mt-1 text-sm text-umber/62">Review everything included in this order.</p>
                </div>
                <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-umber/70">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} units
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-3xl border border-amber-100/90 bg-cream/35 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-umber shadow-sm">
                        {item.quantity}x
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-umber">{item.name}</p>
                        <p className="mt-1 text-sm text-umber/60">
                          {formatCurrency(item.unitPrice, order.currency)} each
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-umber">{formatCurrency(item.totalPrice, order.currency)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-100/90 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-umber">Action center</p>
                  <p className="mt-1 text-sm text-umber/62">Quick shortcuts for the most common after-purchase actions.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ActionButton
                  label="Track Parcel"
                  tone="primary"
                  busy={actionState === "tracking"}
                  onClick={() => runAction("tracking", order.shipping.trackingNumber ? `Tracking number copied: ${order.shipping.trackingNumber}` : "Tracking updates will appear once the courier assigns a parcel number.")}
                />
                <ActionButton
                  label="Cancel Order"
                  tone="danger"
                  busy={actionState === "cancel"}
                  onClick={() => runAction("cancel", order.status === "pending" ? "Cancellation request prepared. Connect this button to your cancellation API when ready." : "This order is already being processed, so cancellation usually needs support approval.")}
                />
                <ActionButton
                  label="Download Invoice"
                  tone="secondary"
                  busy={actionState === "invoice"}
                  onClick={() => runAction("invoice", "Invoice export UI is ready. Hook this action to your PDF or email invoice endpoint.")}
                />
                <ActionButton
                  label="Contact Support"
                  tone="secondary"
                  busy={actionState === "support"}
                  onClick={() => runAction("support", "Support action opened. Connect this to chat, WhatsApp, or your helpdesk flow.")}
                />
              </div>

              {feedback ? (
                <p className="mt-4 rounded-2xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                  {feedback}
                </p>
              ) : null}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-amber-100/90 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-semibold text-umber">Order summary</p>
              <div className="mt-5 space-y-3 text-sm text-umber/74">
                <div className="flex items-center justify-between gap-4">
                  <span>Subtotal</span>
                  <span className="font-semibold text-umber">{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Shipping</span>
                  <span className="font-semibold text-umber">{formatCurrency(order.shippingFee, order.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Tax</span>
                  <span className="font-semibold text-umber">{formatCurrency(order.taxAmount, order.currency)}</span>
                </div>
                <div className="border-t border-amber-100 pt-3 text-base">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-umber">Total paid</span>
                    <span className="font-semibold text-umber">{formatCurrency(order.totalAmount, order.currency)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-100/90 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-semibold text-umber">Shipping information</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl border border-amber-100/80 bg-cream/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Recipient</p>
                  <p className="mt-2 text-sm font-semibold text-umber">{order.shipping.recipientName ?? "Recipient not provided"}</p>
                  <p className="mt-1 text-sm leading-6 text-umber/68">{shippingLine || "Shipping address will appear after checkout metadata is connected."}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-amber-100/80 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Delivery label</p>
                    <p className="mt-2 text-sm font-semibold text-umber">{order.shipping.label ?? "Primary address"}</p>
                  </div>
                  <div className="rounded-3xl border border-amber-100/80 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Courier</p>
                    <p className="mt-2 text-sm font-semibold text-umber">{order.shipping.courier ?? "Assigned soon"}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-100/90 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-semibold text-umber">Payment details</p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-3xl border border-amber-100/80 bg-cream/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Payment status</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                      {order.payment.status}
                    </span>
                    <span className="text-sm text-umber/60">{formatDate(order.payment.paidAt)}</span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-amber-100/80 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Method</p>
                    <p className="mt-2 text-sm font-semibold text-umber">{order.payment.method}</p>
                  </div>
                  <div className="rounded-3xl border border-amber-100/80 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Card / reference</p>
                    <p className="mt-2 text-sm font-semibold text-umber">{order.payment.cardLabel ?? "Reference available after payment sync"}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
