"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type CartRowItem } from "@/components/cart/CartItemRow";

type CartResponse = {
  cart_id: string;
  item_count: number;
  subtotal: number;
  items: CartRowItem[];
};

type ApiErrorPayload = {
  error?: string;
};

type CheckoutSuccessOrder = {
  id?: string | null;
  order_number?: string | null;
  subtotal?: number;
  shipping_fee?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  shipping?: {
    recipient_name?: string | null;
    phone?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
  items?: Array<{
    id: string | number;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
};

type CheckoutSuccessPayload = ApiErrorPayload & {
  success?: boolean;
  order?: CheckoutSuccessOrder;
};

type AddressRow = {
  label?: string | null;
  recipient_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_default?: boolean;
  is_default_shipping?: boolean;
};

type ProfileResponse = {
  user?: {
    addresses?: AddressRow[];
  };
};

type CheckoutAddressForm = {
  country: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
};

type CheckoutAddressPayload = {
  country: string;
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
};

type PaymentMethodId = "adaptis_gateway" | "grab" | "bank_transfer";

type PaymentMethodOption = {
  id: PaymentMethodId;
  title: string;
  subtitle: string;
  note?: string;
  logos: string[];
  description?: string;
};

const CART_SNAPSHOT_KEY = "customer_cart_snapshot";

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "adaptis_gateway",
    title: "ADAPTIS Payment Gateway (formerly iPay88)",
    subtitle: "Redirect to complete your purchase securely.",
    description: "You'll be redirected to ADAPTIS Payment Gateway (formerly iPay88) to complete your purchase.",
    logos: ["VISA", "MC", "FPX", "TnG"],
  },
  {
    id: "grab",
    title: "Grab",
    subtitle: "Pay today or later at 0% interest.",
    logos: ["Grab", "VISA", "MC", "AMEX"],
  },
  {
    id: "bank_transfer",
    title: "Cash Deposit / Online Transfer",
    subtitle: "Pay via bank transfer or cash deposit.",
    logos: [],
  },
];

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("customer_jwt_token");
}

async function requestWithCustomerAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = readToken();
  const headers = new Headers(init.headers ?? undefined);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (res.status === 401 && headers.has("Authorization")) {
    const retryHeaders = new Headers(headers);
    retryHeaders.delete("Authorization");
    res = await fetch(input, {
      ...init,
      headers: retryHeaders,
      credentials: "same-origin",
    });
  }

  return res;
}

function formatApiError(action: string, endpoint: string, status: number, payload?: ApiErrorPayload): string {
  const apiMessage = String(payload?.error ?? "").trim();
  if (apiMessage) {
    return `[${endpoint}] ${action} failed (${status}): ${apiMessage}`;
  }
  return `[${endpoint}] ${action} failed (${status}).`;
}

function readEmailFromToken(): string {
  const token = readToken();
  if (!token) return "guest@checkout.com";
  const parts = token.split(".");
  if (parts.length !== 3) return "guest@checkout.com";
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { email?: unknown };
    return typeof payload.email === "string" && payload.email.trim() ? payload.email : "guest@checkout.com";
  } catch {
    return "guest@checkout.com";
  }
}

function normalizeCartItems(input: unknown): CartRowItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw): CartRowItem | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const productRaw =
        row.product && typeof row.product === "object"
          ? (row.product as Record<string, unknown>)
          : null;

      const productId = String(productRaw?.id ?? row.product_id ?? row.id ?? "");
      if (!productId) return null;

      const quantity = Math.max(1, Math.floor(Number(row.quantity ?? 1)));
      const unitPrice = Number(row.unit_price ?? row.price_at_time ?? row.price ?? 0);
      const lineTotalRaw = Number(row.line_total);
      const priceAtTimeRaw = Number(row.price_at_time);
      const stockRaw = productRaw?.stock;
      const stock = stockRaw == null ? null : Number(stockRaw);

      return {
        id: String(row.id ?? productId),
        product_id: String(row.product_id ?? productId),
        quantity,
        unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
        price_at_time: Number.isFinite(priceAtTimeRaw) ? priceAtTimeRaw : null,
        line_total:
          Number.isFinite(lineTotalRaw)
            ? lineTotalRaw
            : (Number.isFinite(unitPrice) ? unitPrice : 0) * quantity,
        product: {
          id: productId,
          name: String(productRaw?.name ?? row.name ?? "Product"),
          image:
            typeof productRaw?.image === "string"
              ? productRaw.image
              : typeof row.image === "string"
                ? row.image
                : null,
          image_url:
            typeof productRaw?.image_url === "string"
              ? productRaw.image_url
              : typeof row.image_url === "string"
                ? row.image_url
                : null,
          stock: Number.isFinite(stock) ? stock : null,
        },
      };
    })
    .filter((item): item is CartRowItem => item != null);
}

// Hydration-safe helper: called only after mount from useEffect.
// Never call this during initial render so server/client HTML stays identical.
function getCartFromLocalStorage(): CartResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CART_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CartResponse> & { items?: unknown };
    return {
      cart_id: String(parsed.cart_id ?? ""),
      item_count: Number(parsed.item_count ?? 0),
      subtotal: Number(parsed.subtotal ?? 0),
      items: normalizeCartItems(parsed.items),
    };
  } catch {
    return null;
  }
}

function clearCartSnapshot() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_SNAPSHOT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function CartPageSkeleton() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-sage-light/20 p-6 shadow-sm sm:p-10">
          <div className="animate-pulse">
            <div className="h-4 w-28 rounded bg-amber-200/80" />
            <div className="mt-3 h-10 w-56 rounded bg-amber-200/70" />
            <div className="mt-2 h-4 w-80 max-w-full rounded bg-amber-100/90" />
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.45fr_0.9fr]">
            <div className="space-y-6">
              <div className="h-40 rounded-2xl border border-amber-200/70 bg-white p-6 shadow-sm" />
              <div className="h-80 rounded-2xl border border-amber-200/70 bg-white p-6 shadow-sm" />
              <div className="h-44 rounded-2xl border border-amber-200/70 bg-white p-6 shadow-sm" />
            </div>
            <div className="h-72 rounded-2xl border border-amber-200/70 bg-white p-6 shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<CheckoutSuccessOrder | null>(null);
  const [email, setEmail] = useState("guest@checkout.com");
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null);
  const [discountMessage, setDiscountMessage] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<PaymentMethodId>("adaptis_gateway");
  const [addressForm, setAddressForm] = useState<CheckoutAddressForm>({
    country: "Malaysia",
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    phone: "",
  });
  const [sameBillingAsShipping, setSameBillingAsShipping] = useState(true);
  const [billingForm, setBillingForm] = useState<CheckoutAddressForm>({
    country: "Malaysia",
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    phone: "",
  });

  const cartItems = useMemo(() => cart?.items ?? [], [cart?.items]);
  const itemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + Math.max(1, Math.floor(Number(item.quantity ?? 1))), 0),
    [cartItems]
  );
  const subtotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => {
        const unitPrice = Number(item.unit_price);
        const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
        return sum + (Number.isFinite(unitPrice) ? unitPrice : 0) * quantity;
      }, 0),
    [cartItems]
  );
  const shippingEstimate = useMemo(() => (subtotal >= 150 ? 0 : cartItems.length > 0 ? 12 : 0), [cartItems.length, subtotal]);
  const discountAmount = useMemo(() => {
    if (!appliedDiscountCode) return 0;
    if (appliedDiscountCode === "SAVE10") return subtotal * 0.1;
    if (appliedDiscountCode === "FREESHIP") return shippingEstimate;
    return 0;
  }, [appliedDiscountCode, shippingEstimate, subtotal]);
  const total = useMemo(
    () => Math.max(0, subtotal + shippingEstimate - discountAmount),
    [discountAmount, shippingEstimate, subtotal]
  );
  const shippingSummary = useMemo(() => {
    const recipient = [addressForm.firstName.trim(), addressForm.lastName.trim()].filter(Boolean).join(" ");
    const addressLine = [addressForm.address1, addressForm.address2].map((value) => value.trim()).filter(Boolean).join(", ");
    const locality = [addressForm.city, addressForm.state, addressForm.postalCode]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", ");
    const country = addressForm.country.trim();
    return [recipient, addressLine, locality, country].filter(Boolean).join(" · ") || "Shipping address will appear here.";
  }, [addressForm]);

  const applyDiscountCode = () => {
    const normalized = discountCode.trim().toUpperCase();
    if (!normalized) {
      setAppliedDiscountCode(null);
      setDiscountMessage("Enter a code to apply it.");
      return;
    }

    if (normalized === "SAVE10") {
      setAppliedDiscountCode(normalized);
      setDiscountMessage("Code applied: 10% off your order.");
      return;
    }

    if (normalized === "FREESHIP") {
      setAppliedDiscountCode(normalized);
      setDiscountMessage("Code applied: shipping discounted.");
      return;
    }

    setAppliedDiscountCode(null);
    setDiscountMessage("That code is not valid.");
  };

  const fetchCart = useCallback(async (hasLocalSnapshot = false) => {
    const debugLabel = `[cart][page] GET /api/cart`;
    const startedAt = Date.now();
    if (!hasLocalSnapshot) setLoading(true);
    setError(null);
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log(`${debugLabel} start`, { hasLocalSnapshot, startedAt });
      }
      const res = await requestWithCustomerAuth("/api/cart");
      const data = (await res.json().catch(() => ({}))) as ApiErrorPayload & Partial<CartResponse>;
      if (process.env.NODE_ENV !== "production") {
        console.log(`${debugLabel} response`, {
          ok: res.ok,
          status: res.status,
          itemCount: Array.isArray(data.items) ? data.items.length : 0,
          elapsedMs: Date.now() - startedAt,
          error: data.error ?? null,
        });
      }
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth/login?next=/cart");
          return;
        }
        setError(formatApiError("Load cart", "GET /api/cart", res.status, data));
        if (!hasLocalSnapshot) {
          setCart({ cart_id: "", item_count: 0, subtotal: 0, items: [] });
        }
        return;
      }
      setCart({
        cart_id: String(data.cart_id ?? ""),
        item_count: Number(data.item_count ?? 0),
        subtotal: Number(data.subtotal ?? 0),
        items: normalizeCartItems(data.items),
      });
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.log(`${debugLabel} network/error`, { elapsedMs: Date.now() - startedAt });
      }
      setError("[GET /api/cart] Could not reach server.");
      if (!hasLocalSnapshot) {
        setCart({ cart_id: "", item_count: 0, subtotal: 0, items: [] });
      }
    } finally {
      if (!hasLocalSnapshot) setLoading(false);
    }
  }, [router]);

  const fetchDefaultAddress = useCallback(async () => {
    try {
      const res = await requestWithCustomerAuth("/api/profile");
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as ProfileResponse;
      const addresses = Array.isArray(data.user?.addresses) ? data.user?.addresses : [];
      const picked =
        addresses.find((a) => a?.is_default_shipping ?? a?.is_default) ??
        addresses.find((a) => a?.is_default) ??
        addresses[0];
      if (!picked) return;

      const recipient = String(picked.recipient_name ?? "").trim();
      const [first, ...rest] = recipient.split(/\s+/).filter(Boolean);
      const last = rest.join(" ");
      const nextAddress = {
        country: String(picked.country ?? "Malaysia"),
        firstName: first || "",
        lastName: last || "",
        address1: String(picked.address_line1 ?? ""),
        address2: String(picked.address_line2 ?? ""),
        city: String(picked.city ?? ""),
        state: String(picked.state ?? ""),
        postalCode: String(picked.postal_code ?? ""),
        phone: "",
      };
      setAddressForm((prev) => ({
        ...prev,
        ...nextAddress,
      }));
      setBillingForm((prev) => ({ ...prev, ...nextAddress }));
    } catch {
      // Keep defaults if profile fetch fails.
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (process.env.NODE_ENV !== "production") {
      console.log("[cart][page] mounted");
    }
    setEmail(readEmailFromToken());
    const localCart = getCartFromLocalStorage();
    const hasLocalSnapshot = Boolean(localCart && localCart.items.length > 0);
    if (localCart) setCart(localCart);
    if (hasLocalSnapshot) setLoading(false);

    void fetchCart(hasLocalSnapshot);
    void fetchDefaultAddress();
  }, [fetchCart, fetchDefaultAddress]);

  useEffect(() => {
    const onCartChanged = () => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[cart][page] cart-changed event -> refetch");
      }
      const snapshot = getCartFromLocalStorage();
      if (snapshot) {
        setCart(snapshot);
      }
      void fetchCart(true);
    };
    window.addEventListener("cart-changed", onCartChanged);
    return () => window.removeEventListener("cart-changed", onCartChanged);
  }, [fetchCart]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[cart][page] prefetch /profile/orders");
    }
    router.prefetch("/profile/orders");
  }, [router]);

  const handleCheckout = async () => {
    setCheckoutError(null);
    if (!cart || cartItems.length === 0) return;

    setCheckingOut(true);
    try {
      const recipientName = `${addressForm.firstName} ${addressForm.lastName}`.trim();
      const profileRes = await requestWithCustomerAuth("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address_label: "Home",
          address_recipient_name: recipientName || null,
          address_line1: addressForm.address1.trim(),
          address_line2: addressForm.address2.trim() || null,
          address_city: addressForm.city.trim(),
          address_state: addressForm.state.trim(),
          address_postal_code: addressForm.postalCode.trim(),
          address_country: addressForm.country.trim(),
        }),
      });
      if (!profileRes.ok) {
        const profilePayload = (await profileRes.json().catch(() => ({}))) as ApiErrorPayload;
        setCheckoutError(
          formatApiError("Save shipping address", "PUT /api/profile", profileRes.status, profilePayload)
        );
        setCheckingOut(false);
        return;
      }

      const toPayload = (form: CheckoutAddressForm): CheckoutAddressPayload => ({
        country: form.country.trim(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        address_line1: form.address1.trim(),
        address_line2: form.address2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postalCode.trim(),
        phone: form.phone.trim(),
      });
      const shippingPayload = toPayload(addressForm);
      const billingPayload = sameBillingAsShipping ? shippingPayload : toPayload(billingForm);

      const res = await requestWithCustomerAuth("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            id: item.product_id,
            quantity: item.quantity,
            name: item.product.name,
            price: item.price_at_time,
          })),
          shipping_address: shippingPayload,
          billing_address: billingPayload,
          billing_same_as_shipping: sameBillingAsShipping,
          payment_method: paymentMethodId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as CheckoutSuccessPayload;
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth/login?next=/cart");
          return;
        }
        if (res.status === 400 && String(data.error ?? "").toLowerCase().includes("shipping address")) {
          router.push("/address-book");
          return;
        }
        setCheckoutError(formatApiError("Checkout", "POST /api/checkout", res.status, data));
        return;
      }
      const fallbackOrder: CheckoutSuccessOrder = {
        order_number: null,
        subtotal,
        shipping_fee: shippingEstimate,
        tax_amount: 0,
        total_amount: subtotal + shippingEstimate,
        currency: "MYR",
        shipping: {
          recipient_name: recipientName || null,
          phone: addressForm.phone.trim() || null,
          address_line1: addressForm.address1.trim() || null,
          address_line2: addressForm.address2.trim() || null,
          city: addressForm.city.trim() || null,
          state: addressForm.state.trim() || null,
          postal_code: addressForm.postalCode.trim() || null,
          country: addressForm.country.trim() || null,
        },
        items: cartItems.map((item) => ({
          id: item.product_id,
          name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.unit_price * item.quantity,
        })),
      };
      setPlacedOrder(data.order ?? fallbackOrder);
      setCheckoutSuccess(true);
      router.prefetch("/profile/orders");
      setCart({ cart_id: cart.cart_id, item_count: 0, subtotal: 0, items: [] });
      clearCartSnapshot();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-changed"));
      }
    } catch {
      setCheckoutError("[POST /api/checkout] Could not reach server.");
    } finally {
      setCheckingOut(false);
    }
  };

  // Important hydration fix:
  // - Server render and first client render both return the same skeleton.
  // - We only read localStorage and render cart-dependent UI after mount.
  if (!mounted || loading) return <CartPageSkeleton />;

  if (checkoutSuccess) {
    const order = placedOrder;
    const shipping = order?.shipping;
    const shippingLine = [
      shipping?.address_line1,
      shipping?.address_line2,
      shipping?.city,
      shipping?.state,
      shipping?.postal_code,
      shipping?.country,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(", ");

    return (
      <div className="bg-cream">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-zinc-900">Thank you!</h2>
              <p className="mt-2 text-zinc-600">Your order has been placed successfully.</p>
              {order?.order_number ? (
                <p className="mt-2 text-sm font-semibold text-zinc-800">
                  Order No:{" "}
                  <Link
                    href={`/profile/orders?order=${encodeURIComponent(String(order.id ?? order.order_number ?? ""))}`}
                    className="text-umber underline decoration-amber-400 underline-offset-4 transition hover:text-umber/80"
                  >
                    {order.order_number}
                  </Link>
                </p>
              ) : null}
              <p className="mt-2 text-sm text-zinc-500">
                Your order history is saved. Open order summary when you are ready.
              </p>
            </div>

            <div className="mt-8 rounded-xl border border-zinc-200 p-5">
              <h3 className="text-lg font-semibold text-zinc-900">Current Order Summary</h3>
              <div className="mt-4 space-y-3">
                {order?.items?.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-2 last:border-b-0">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
                      <p className="text-xs text-zinc-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">RM{Number(item.line_total ?? 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1 border-t border-zinc-200 pt-3 text-sm text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>RM{Number(order?.subtotal ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <span>RM{Number(order?.shipping_fee ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tax</span>
                  <span>RM{Number(order?.tax_amount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 text-base font-semibold text-zinc-900">
                  <span>Total</span>
                  <span>RM{Number(order?.total_amount ?? 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-900">Shipping Address</p>
                <p className="mt-1">{shipping?.recipient_name || "Recipient not provided"}</p>
                {shipping?.phone ? <p>{shipping.phone}</p> : null}
                <p>{shippingLine || "Address not available"}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={`/profile/orders?order=${encodeURIComponent(String(order?.id ?? order?.order_number ?? ""))}`}
                className="inline-block rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                View Order Summary
              </Link>
              <Link
                href="/products"
                className="inline-block rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="bg-cream">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-zinc-900">Cart</h1>
            <p className="mt-1 text-zinc-600">0 items</p>
            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}
            <p className="mt-8 text-center text-lg font-semibold text-zinc-900">Your cart is empty</p>
            <p className="mt-2 text-center text-sm text-zinc-600">Browse products and add your favorites.</p>
            <div className="mt-8 text-center">
              <Link
                href="/products"
                className="inline-flex rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-16">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-sage-light/20 p-6 shadow-sm sm:p-10">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Secure Checkout</p>
            <h1 className="text-4xl font-bold tracking-tight text-umber sm:text-5xl">Checkout</h1>
            <p className="text-sm text-umber/70">Review your details and place your order.</p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.45fr_0.9fr]">
            <section className="space-y-6">
              <div className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold text-umber">Contact Information</h2>
                <div className="mt-4 rounded-xl border border-amber-200 bg-cream px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Email address</p>
                  <p className="mt-1 text-base font-medium text-umber">{email}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold text-umber">Shipping Address</h2>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Country/Region</p>
                    <input
                      value={addressForm.country}
                      onChange={(event) => setAddressForm((prev) => ({ ...prev, country: event.target.value }))}
                      className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">First name</p>
                      <input
                        value={addressForm.firstName}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, firstName: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Last name</p>
                      <input
                        value={addressForm.lastName}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, lastName: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Address</p>
                    <input
                      value={addressForm.address1}
                      onChange={(event) => setAddressForm((prev) => ({ ...prev, address1: event.target.value }))}
                      className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                    />
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Apartment, suite, etc.</p>
                    <input
                      value={addressForm.address2}
                      onChange={(event) => setAddressForm((prev) => ({ ...prev, address2: event.target.value }))}
                      className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">City</p>
                      <input
                        value={addressForm.city}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, city: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Postal code</p>
                      <input
                        value={addressForm.postalCode}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">State/Region</p>
                      <input
                        value={addressForm.state}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, state: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Phone</p>
                      <input
                        value={addressForm.phone}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, phone: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                  </div>
                </div>
                <label className="mt-4 inline-flex items-center gap-3 text-sm font-semibold text-umber">
                  <input
                    type="checkbox"
                    checked={sameBillingAsShipping}
                    onChange={(event) => setSameBillingAsShipping(event.target.checked)}
                    className="h-4 w-4 rounded border-amber-300 text-terracotta focus:ring-terracotta"
                  />
                  Billing address is the same as shipping
                </label>
                {sameBillingAsShipping ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-cream px-3 py-2 text-sm text-umber/80">
                    Billing summary: {shippingSummary}
                  </p>
                ) : null}
              </div>

              {!sameBillingAsShipping ? (
                <div className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-semibold text-umber">Billing Address</h2>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Country/Region</p>
                      <input
                        value={billingForm.country}
                        onChange={(event) => setBillingForm((prev) => ({ ...prev, country: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">First name</p>
                        <input
                          value={billingForm.firstName}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, firstName: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Last name</p>
                        <input
                          value={billingForm.lastName}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, lastName: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Address</p>
                      <input
                        value={billingForm.address1}
                        onChange={(event) => setBillingForm((prev) => ({ ...prev, address1: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Apartment, suite, etc.</p>
                      <input
                        value={billingForm.address2}
                        onChange={(event) => setBillingForm((prev) => ({ ...prev, address2: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">City</p>
                        <input
                          value={billingForm.city}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, city: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Postal code</p>
                        <input
                          value={billingForm.postalCode}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">State/Region</p>
                        <input
                          value={billingForm.state}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, state: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-cream px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Phone</p>
                        <input
                          value={billingForm.phone}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, phone: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-umber">Payment</h2>
                    <p className="mt-1 text-sm text-umber/70">All transactions are secure and encrypted.</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-zinc-700">VISA</span>
                    <span className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-zinc-700">MC</span>
                    <span className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-zinc-700">FPX</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {PAYMENT_METHODS.map((method) => {
                    const selected = paymentMethodId === method.id;
                    return (
                      <label
                        key={method.id}
                        className={`block cursor-pointer rounded-2xl border p-4 transition ${
                          selected
                            ? "border-amber-300 bg-amber-50 shadow-sm"
                            : "border-zinc-200 bg-white hover:border-amber-200 hover:bg-amber-50/40"
                        }`}
                      >
                        <div className="flex items-start gap-3 sm:items-center">
                          <input
                            type="radio"
                            name="payment-method"
                            value={method.id}
                            checked={selected}
                            onChange={() => setPaymentMethodId(method.id)}
                            className="mt-1 h-5 w-5 border-zinc-300 text-umber focus:ring-umber sm:mt-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-medium text-umber">{method.title}</p>
                              {selected ? (
                                <span className="rounded-full bg-umber px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                                  Selected
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-umber/70">{method.subtitle}</p>
                            {method.description && selected ? (
                              <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                                {method.description}
                              </div>
                            ) : null}
                          </div>
                          {method.logos.length > 0 ? (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {method.logos.map((logo) => (
                                <span
                                  key={logo}
                                  className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-zinc-700"
                                >
                                  {logo}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl border border-amber-200 bg-cream px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-umber">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                      <path d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" />
                    </svg>
                    <span>Secure payment</span>
                  </div>
                  <p className="mt-1 text-sm text-umber/70">Payments are encrypted and processed securely.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-amber-200/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/products" className="text-sm font-semibold text-umber/80 transition hover:text-umber hover:underline">
                  Return to shopping
                </Link>
                <button
                  type="button"
                  onClick={() => void handleCheckout()}
                  disabled={checkingOut}
                  className="w-full rounded-xl bg-terracotta px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-terracotta/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {checkingOut ? "Processing..." : "Place Order"}
                </button>
              </div>
            </section>

            <aside className="h-fit rounded-2xl border border-amber-200/70 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-zinc-900">Order Summary</h3>
                    <p className="mt-1 text-sm text-zinc-500">{itemCount} items in your cart</p>
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    MYR
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {cartItems.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">{item.product.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {item.quantity} x RM{Number(item.unit_price).toFixed(2)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-zinc-900">
                        RM{(item.unit_price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                    <label htmlFor="discount-code" className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Discount code
                    </label>
                    <input
                      id="discount-code"
                      value={discountCode}
                      onChange={(event) => setDiscountCode(event.target.value)}
                      placeholder="Enter code"
                      className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyDiscountCode}
                    className="min-h-[52px] rounded-xl border border-zinc-200 bg-zinc-100 px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
                  >
                    Apply
                  </button>
                </div>
                {discountMessage ? <p className="mt-2 text-xs text-zinc-500">{discountMessage}</p> : null}

                <div className="mt-5 space-y-3 border-t border-zinc-200 pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-600">Subtotal</span>
                    <span className="font-medium text-zinc-900">
                      RM{subtotal.toFixed(2)} <span className="text-zinc-500">· {itemCount} items</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-zinc-600">
                      <span>Shipping</span>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-400 text-[11px] font-bold text-zinc-500">
                        ?
                      </span>
                    </div>
                    <span className="font-medium text-zinc-700">
                      {addressForm.address1.trim() ? `RM${shippingEstimate.toFixed(2)}` : "Enter shipping address"}
                    </span>
                  </div>
                  {discountAmount > 0 ? (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-600">Discount</span>
                      <span className="font-medium text-emerald-700">-RM{discountAmount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-3">
                    <span className="text-lg font-semibold text-zinc-900">Total</span>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">MYR</p>
                      <p className="text-2xl font-bold tracking-tight text-zinc-900">RM{total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-zinc-500">Shipping and tax are confirmed at the next step.</p>
              </div>
              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}
              {checkoutError ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{checkoutError}</p>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
