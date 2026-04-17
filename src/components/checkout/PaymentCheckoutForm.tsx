"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

type OrderTotals = {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
};

const MOCK_TOTALS: OrderTotals = {
  subtotal: 189.9,
  shipping: 12,
  tax: 15.19,
  total: 217.09,
  currency: "USD",
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatCardNumber(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function luhnCheck(rawCardNumber: string): boolean {
  const digits = rawCardNumber.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function notExpired(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

// Centralized form validation rules for checkout payment + billing fields.
const paymentSchema = z.object({
  cardNumber: z
    .string()
    .min(1, "Card number is required")
    .refine((value) => luhnCheck(value), "Please enter a valid card number"),
  cardholderName: z
    .string()
    .min(1, "Cardholder name is required")
    .min(2, "Cardholder name must be at least 2 characters"),
  expiryDate: z
    .string()
    .min(1, "Expiry date is required")
    .regex(/^\d{2}\/\d{2}$/, "Use MM/YY format")
    .refine((value) => notExpired(value), "Card is expired"),
  cvc: z.string().regex(/^\d{3,4}$/, "CVC/CVV must be 3 or 4 digits"),
  sameAsShipping: z.boolean(),
  billingAddress1: z.string().min(1, "Address line 1 is required"),
  billingAddress2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  stateProvince: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  zipPostalCode: z.string().min(1, "ZIP / Postal code is required"),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

type PaymentSubmissionPayload = {
  payment_token: string;
  payment_method: {
    brand: "card";
    last4: string;
    exp_month: string;
    exp_year: string;
    cardholder_name: string;
  };
  billing_address: {
    same_as_shipping: boolean;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state_province?: string;
    country: string;
    zip_postal_code: string;
  };
  order_totals: OrderTotals;
};

function buildMockPaymentToken(): string {
  return `tok_mock_${Math.random().toString(36).slice(2, 14)}`;
}

// Simulates a PSP tokenization call and returns backend-ready data without raw PAN/CVC.
async function tokenizePayment(values: PaymentFormValues): Promise<PaymentSubmissionPayload> {
  const cardDigits = values.cardNumber.replace(/\D/g, "");
  const [expMonth, expYear] = values.expiryDate.split("/");

  await new Promise((resolve) => setTimeout(resolve, 1100));

  return {
    payment_token: buildMockPaymentToken(),
    payment_method: {
      brand: "card",
      last4: cardDigits.slice(-4),
      exp_month: expMonth,
      exp_year: expYear,
      cardholder_name: values.cardholderName.trim(),
    },
    billing_address: {
      same_as_shipping: values.sameAsShipping,
      address_line_1: values.billingAddress1.trim(),
      address_line_2: values.billingAddress2?.trim() || undefined,
      city: values.city.trim(),
      state_province: values.stateProvince?.trim() || undefined,
      country: values.country.trim(),
      zip_postal_code: values.zipPostalCode.trim(),
    },
    order_totals: MOCK_TOTALS,
  };
}

const inputBaseClass =
  "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
const labelClass = "text-sm font-medium text-zinc-900";
const errorClass = "mt-1 text-xs font-medium text-red-600";

function LockIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-700" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" />
    </svg>
  );
}

function CardBrands() {
  return (
    <div className="flex items-center gap-2" aria-label="Supported card brands">
      <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold tracking-wide text-zinc-700">
        VISA
      </span>
      <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold tracking-wide text-zinc-700">
        MASTERCARD
      </span>
      <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold tracking-wide text-zinc-700">
        AMEX
      </span>
    </div>
  );
}

export default function PaymentCheckoutForm() {
  const [submittedPayload, setSubmittedPayload] = useState<PaymentSubmissionPayload | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    mode: "onChange",
    defaultValues: {
      cardNumber: "",
      cardholderName: "",
      expiryDate: "",
      cvc: "",
      sameAsShipping: true,
      billingAddress1: "",
      billingAddress2: "",
      city: "",
      stateProvince: "",
      country: "",
      zipPostalCode: "",
    },
  });

  const sameAsShipping = useWatch({ control, name: "sameAsShipping" });
  const samplePayload = useMemo(
    () =>
      submittedPayload ?? {
        payment_token: "tok_mock_2g1x9v7hs81q",
        payment_method: {
          brand: "card",
          last4: "4242",
          exp_month: "12",
          exp_year: "30",
          cardholder_name: "Jordan Lee",
        },
        billing_address: {
          same_as_shipping: true,
          address_line_1: "123 Market Street",
          city: "San Francisco",
          country: "US",
          zip_postal_code: "94105",
        },
        order_totals: MOCK_TOTALS,
      },
    [submittedPayload]
  );

  const onSubmit = async (values: PaymentFormValues) => {
    // Only tokenized metadata is kept/forwarded; raw card details are never persisted.
    const payload = await tokenizePayment(values);
    setSubmittedPayload(payload);
    console.log("Tokenized checkout payload", payload);
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr] lg:items-start">
        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
          noValidate
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Payment details</h2>
            <CardBrands />
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <LockIcon />
              Secure payment
            </p>
            <p className="mt-1 text-xs text-emerald-800">Your payment is encrypted in transit and tokenized before submission.</p>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="cardNumber" className={labelClass}>
                Card number
              </label>
              <input
                id="cardNumber"
                autoComplete="cc-number"
                inputMode="numeric"
                maxLength={23}
                {...register("cardNumber")}
                onChange={(event) =>
                  setValue("cardNumber", formatCardNumber(event.currentTarget.value), {
                    shouldTouch: true,
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className={inputBaseClass}
                placeholder="1234 5678 9012 3456"
                aria-invalid={Boolean(errors.cardNumber)}
              />
              {errors.cardNumber ? <p className={errorClass}>{errors.cardNumber.message}</p> : null}
            </div>

            <div>
              <label htmlFor="cardholderName" className={labelClass}>
                Cardholder name
              </label>
              <input
                id="cardholderName"
                autoComplete="cc-name"
                {...register("cardholderName")}
                className={inputBaseClass}
                placeholder="Full name on card"
                aria-invalid={Boolean(errors.cardholderName)}
              />
              {errors.cardholderName ? <p className={errorClass}>{errors.cardholderName.message}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="expiryDate" className={labelClass}>
                  Expiry date (MM/YY)
                </label>
                <input
                  id="expiryDate"
                  autoComplete="cc-exp"
                  inputMode="numeric"
                  maxLength={5}
                  {...register("expiryDate")}
                  onChange={(event) =>
                    setValue("expiryDate", formatExpiry(event.currentTarget.value), {
                      shouldTouch: true,
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className={inputBaseClass}
                  placeholder="MM/YY"
                  aria-invalid={Boolean(errors.expiryDate)}
                />
                {errors.expiryDate ? <p className={errorClass}>{errors.expiryDate.message}</p> : null}
              </div>

              <div>
                <label htmlFor="cvc" className={labelClass}>
                  CVC/CVV
                </label>
                <input
                  id="cvc"
                  autoComplete="cc-csc"
                  inputMode="numeric"
                  maxLength={4}
                  {...register("cvc")}
                  onChange={(event) =>
                    setValue("cvc", event.currentTarget.value.replace(/\D/g, "").slice(0, 4), {
                      shouldTouch: true,
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className={inputBaseClass}
                  placeholder="123"
                  aria-invalid={Boolean(errors.cvc)}
                />
                {errors.cvc ? <p className={errorClass}>{errors.cvc.message}</p> : null}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-200 pt-5">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900">
              <input
                type="checkbox"
                {...register("sameAsShipping")}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
              />
              Billing address is the same as shipping
            </label>

            {!sameAsShipping ? (
              <p className="mt-2 text-xs text-zinc-600">
                Billing fields are shown below so you can provide a different billing address.
              </p>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="billingAddress1" className={labelClass}>
                  Billing address line 1
                </label>
                <input
                  id="billingAddress1"
                  autoComplete="address-line1"
                  {...register("billingAddress1")}
                  className={inputBaseClass}
                  placeholder="Street address"
                  aria-invalid={Boolean(errors.billingAddress1)}
                />
                {errors.billingAddress1 ? <p className={errorClass}>{errors.billingAddress1.message}</p> : null}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="billingAddress2" className={labelClass}>
                  Billing address line 2 <span className="text-zinc-500">(optional)</span>
                </label>
                <input
                  id="billingAddress2"
                  autoComplete="address-line2"
                  {...register("billingAddress2")}
                  className={inputBaseClass}
                  placeholder="Apartment, suite, unit, etc."
                  aria-invalid={Boolean(errors.billingAddress2)}
                />
                {errors.billingAddress2 ? <p className={errorClass}>{errors.billingAddress2.message}</p> : null}
              </div>

              <div>
                <label htmlFor="city" className={labelClass}>
                  City
                </label>
                <input
                  id="city"
                  autoComplete="address-level2"
                  {...register("city")}
                  className={inputBaseClass}
                  placeholder="City"
                  aria-invalid={Boolean(errors.city)}
                />
                {errors.city ? <p className={errorClass}>{errors.city.message}</p> : null}
              </div>

              <div>
                <label htmlFor="stateProvince" className={labelClass}>
                  State / Province
                </label>
                <input
                  id="stateProvince"
                  autoComplete="address-level1"
                  {...register("stateProvince")}
                  className={inputBaseClass}
                  placeholder="State or province"
                  aria-invalid={Boolean(errors.stateProvince)}
                />
                {errors.stateProvince ? <p className={errorClass}>{errors.stateProvince.message}</p> : null}
              </div>

              <div>
                <label htmlFor="country" className={labelClass}>
                  Country
                </label>
                <input
                  id="country"
                  autoComplete="country-name"
                  {...register("country")}
                  className={inputBaseClass}
                  placeholder="Country"
                  aria-invalid={Boolean(errors.country)}
                />
                {errors.country ? <p className={errorClass}>{errors.country.message}</p> : null}
              </div>

              <div>
                <label htmlFor="zipPostalCode" className={labelClass}>
                  ZIP / Postal code
                </label>
                <input
                  id="zipPostalCode"
                  autoComplete="postal-code"
                  {...register("zipPostalCode")}
                  className={inputBaseClass}
                  placeholder="ZIP / Postal code"
                  aria-invalid={Boolean(errors.zipPostalCode)}
                />
                {errors.zipPostalCode ? <p className={errorClass}>{errors.zipPostalCode.message}</p> : null}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="mt-6 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isSubmitting ? "Processing payment..." : "Pay now"}
          </button>
        </form>

        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6">
          <h3 className="text-lg font-semibold text-zinc-900">Order summary</h3>
          <dl className="mt-4 space-y-2 text-sm text-zinc-700">
            <div className="flex items-center justify-between">
              <dt>Subtotal</dt>
              <dd>{formatCurrency(MOCK_TOTALS.subtotal, MOCK_TOTALS.currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Shipping</dt>
              <dd>{formatCurrency(MOCK_TOTALS.shipping, MOCK_TOTALS.currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Tax</dt>
              <dd>{formatCurrency(MOCK_TOTALS.tax, MOCK_TOTALS.currency)}</dd>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 text-base font-semibold text-zinc-900">
              <dt>Total</dt>
              <dd>{formatCurrency(MOCK_TOTALS.total, MOCK_TOTALS.currency)}</dd>
            </div>
          </dl>

          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Sample onSubmit payload</p>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-zinc-800">
              {JSON.stringify(samplePayload, null, 2)}
            </pre>
          </div>
        </aside>
      </div>
    </section>
  );
}
