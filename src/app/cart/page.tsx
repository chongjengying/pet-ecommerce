"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CartItemRow, { type CartRowItem } from "@/components/cart/CartItemRow";
import { useCart } from "@/context/CartContext";

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
  voucher_code?: string | null;
  voucher_discount_amount?: number;
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
  id?: string | null;
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
  deliveryInstruction: string;
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
  delivery_instruction?: string | null;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
};

type PaymentMethodId = "adaptis_gateway" | "grab" | "bank_transfer";
type DeliveryMethodId = "west_my_standard" | "pickup_store" | "pickup_express";

type PaymentMethodOption = {
  id: PaymentMethodId;
  title: string;
  subtitle: string;
  note?: string;
  logos: string[];
  description?: string;
};

const CART_SNAPSHOT_KEY = "customer_cart_snapshot";
const APPLIED_VOUCHER_KEY = "applied_voucher_snapshot";

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
const DELIVERY_METHOD_FEES: Record<DeliveryMethodId, number> = {
  west_my_standard: 7,
  pickup_store: 0,
  pickup_express: 0,
};
const CART_HERO_ORIGINAL_PHOTO = "/HomePage.png";

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

    const items = normalizeCartItems(parsed.items);
    if (items.length > 0 || parsed.cart_id !== undefined) {
      return {
        cart_id: String(parsed.cart_id ?? ""),
        item_count: Number(parsed.item_count ?? 0),
        subtotal: Number(parsed.subtotal ?? 0),
        items,
      };
    }

    // Backward/parallel compatibility: CartContext persists a smaller snapshot shape:
    // { items: [{ id, name, price, image?, image_url?, stock?, quantity }], item_count, subtotal, saved_at }
    const parsedAny = parsed as unknown as { items?: unknown; item_count?: unknown; subtotal?: unknown };
    const simplified = Array.isArray(parsedAny.items) ? (parsedAny.items as unknown[]) : [];
    const mapped: CartRowItem[] = simplified
      .map((rawItem): CartRowItem | null => {
        if (!rawItem || typeof rawItem !== "object") return null;
        const row = rawItem as Record<string, unknown>;
        const productId = String(row.id ?? "").trim();
        if (!productId) return null;
        const quantity = Math.max(1, Math.floor(Number(row.quantity ?? 1)));
        const unitPrice = Number(row.price ?? 0);
        const stockRaw = row.stock;
        const stock = stockRaw == null ? null : Number(stockRaw);
        return {
          id: productId,
          product_id: productId,
          quantity,
          unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
          price_at_time: null,
          line_total: (Number.isFinite(unitPrice) ? unitPrice : 0) * quantity,
          product: {
            id: productId,
            name: String(row.name ?? "Product"),
            image: typeof row.image === "string" ? row.image : null,
            image_url: typeof row.image_url === "string" ? row.image_url : null,
            stock: Number.isFinite(stock) ? stock : null,
          },
        };
      })
      .filter((it): it is CartRowItem => it != null);

    if (mapped.length === 0) return null;
    const subtotal = mapped.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
    const itemCount = mapped.reduce((sum, it) => sum + it.quantity, 0);
    return {
      cart_id: "",
      item_count: Number.isFinite(Number(parsedAny.item_count)) ? Number(parsedAny.item_count) : itemCount,
      subtotal: Number.isFinite(Number(parsedAny.subtotal)) ? Number(parsedAny.subtotal) : subtotal,
      items: mapped,
    };
  } catch {
    return null;
  }
}

function readUsernameFromToken(): string {
  const token = readToken();
  if (!token) return "Guest";
  const parts = token.split(".");
  if (parts.length !== 3) return "Guest";
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      username?: unknown;
      email?: unknown;
    };
    if (typeof payload.username === "string" && payload.username.trim()) return payload.username.trim();
    if (typeof payload.email === "string" && payload.email.trim()) return payload.email.split("@")[0] || "Guest";
    return "Guest";
  } catch {
    return "Guest";
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

export function CartPageContent({ forceCheckout = false }: { forceCheckout?: boolean }) {
  const router = useRouter();
  const cartRoute = forceCheckout ? "/checkout" : "/cart";
  const { items: contextItems, updateQuantity, removeFromCart, flushPendingQuantities } = useCart();
  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [shippingInfoOpen, setShippingInfoOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<CheckoutSuccessOrder | null>(null);
  const [email, setEmail] = useState("guest@checkout.com");
  const [profileName, setProfileName] = useState("Guest");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null);
  const [appliedVoucherDiscountAmount, setAppliedVoucherDiscountAmount] = useState(0);
  const [discountMessage, setDiscountMessage] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<PaymentMethodId>("adaptis_gateway");
  const [deliveryMethodId, setDeliveryMethodId] = useState<DeliveryMethodId>("west_my_standard");
  const [pickupLocation, setPickupLocation] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [shippingCollapseFx, setShippingCollapseFx] = useState(false);
  const [paymentSlideIn, setPaymentSlideIn] = useState(true);
  const transitionTimersRef = useRef<number[]>([]);
  const [addressForm, setAddressForm] = useState<CheckoutAddressForm>({
    country: "Malaysia",
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    deliveryInstruction: "",
    city: "",
    state: "",
    postalCode: "",
    phone: "",
  });
  const [sameBillingAsShipping, setSameBillingAsShipping] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<AddressRow[]>([]);
  const [showMyAddresses, setShowMyAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [editingCurrentAddress, setEditingCurrentAddress] = useState(false);
  const [billingForm, setBillingForm] = useState<CheckoutAddressForm>({
    country: "Malaysia",
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    deliveryInstruction: "",
    city: "",
    state: "",
    postalCode: "",
    phone: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(APPLIED_VOUCHER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: unknown; discount_amount?: unknown };
      const code = String(parsed.code ?? "").trim().toUpperCase();
      const amount = Number(parsed.discount_amount ?? 0);
      if (code) setAppliedDiscountCode(code);
      if (Number.isFinite(amount) && amount > 0) setAppliedVoucherDiscountAmount(amount);
    } catch {
      // Ignore invalid snapshot.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!appliedDiscountCode) {
        window.localStorage.removeItem(APPLIED_VOUCHER_KEY);
        return;
      }
      window.localStorage.setItem(
        APPLIED_VOUCHER_KEY,
        JSON.stringify({
          code: appliedDiscountCode,
          discount_amount: appliedVoucherDiscountAmount,
          saved_at: Date.now(),
        })
      );
    } catch {
      // Ignore storage failures.
    }
  }, [appliedDiscountCode, appliedVoucherDiscountAmount]);

  const clearTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach((id) => window.clearTimeout(id));
    transitionTimersRef.current = [];
  }, []);

  const playAddressSaveTransition = useCallback(() => {
    clearTransitionTimers();
    setShippingCollapseFx(true);
    setPaymentSlideIn(false);
    transitionTimersRef.current.push(
      window.setTimeout(() => {
        setEditingCurrentAddress(false);
        setShippingCollapseFx(false);
      }, 300)
    );
    transitionTimersRef.current.push(
      window.setTimeout(() => {
        setPaymentSlideIn(true);
      }, 220)
    );
  }, [clearTransitionTimers]);

  // Single source of truth: CartContext items. Map to this page's row shape.
  const cartItems = useMemo<CartRowItem[]>(
    () =>
      (contextItems ?? []).map((item) => ({
        id: String(item.id),
        product_id: String(item.id),
        quantity: Math.max(1, Math.floor(Number(item.quantity ?? 1))),
        unit_price: Number(item.price ?? 0),
        price_at_time: null,
        line_total: Number(item.price ?? 0) * Math.max(1, Math.floor(Number(item.quantity ?? 1))),
        product: {
          id: String(item.id),
          name: String(item.name ?? "Product"),
          image: typeof item.image === "string" ? item.image : null,
          image_url: typeof item.image_url === "string" ? item.image_url : null,
          stock: item.stock == null ? null : Number(item.stock),
        },
      })),
    [contextItems]
  );
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
  const shippingEstimate = useMemo(() => {
    if (cartItems.length <= 0) return 0;
    return DELIVERY_METHOD_FEES[deliveryMethodId] ?? 0;
  }, [cartItems.length, deliveryMethodId]);
  const freeShippingThreshold = 150;
  const freeShippingProgress = useMemo(
    () => Math.min(100, Math.round((Math.max(0, subtotal) / freeShippingThreshold) * 100)),
    [subtotal]
  );
  const freeShippingRemaining = useMemo(
    () => Math.max(0, freeShippingThreshold - subtotal),
    [subtotal]
  );
  const discountAmount = useMemo(
    () => Math.max(0, Number(appliedVoucherDiscountAmount || 0)),
    [appliedVoucherDiscountAmount]
  );
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
  const profileBadge = useMemo(() => {
    const base = (email || "guest").split("@")[0] || "guest";
    const parts = base.split(/[.\s_-]+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
    return initials || "G";
  }, [email]);

  const applyDiscountCode = async () => {
    const normalized = discountCode.trim().toUpperCase();
    if (!normalized) {
      setAppliedDiscountCode(null);
      setAppliedVoucherDiscountAmount(0);
      setDiscountMessage("Enter a code to apply it.");
      return;
    }
    try {
      const res = await requestWithCustomerAuth("/api/vouchers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error_code?: string;
        pricing?: { voucher_discount?: number };
      };
      if (!res.ok || !data.success) {
        setAppliedDiscountCode(null);
        setAppliedVoucherDiscountAmount(0);
        setDiscountMessage(data.message || "That code is not valid.");
        return;
      }
      setAppliedDiscountCode(normalized);
      setAppliedVoucherDiscountAmount(Number(data.pricing?.voucher_discount ?? 0));
      setDiscountMessage(`Code applied: ${normalized}`);
    } catch {
      setAppliedDiscountCode(null);
      setAppliedVoucherDiscountAmount(0);
      setDiscountMessage("Could not apply voucher. Please try again.");
    }
  };

  const handleDecrease = useCallback(
    (itemId: string) => {
      const item = cartItems.find((i) => String(i.id) === String(itemId));
      if (!item) return;
      updateQuantity(item.product_id, Math.max(1, item.quantity - 1));
    },
    [cartItems, updateQuantity]
  );

  const handleIncrease = useCallback(
    (itemId: string) => {
      const item = cartItems.find((i) => String(i.id) === String(itemId));
      if (!item) return;
      updateQuantity(item.product_id, item.quantity + 1);
    },
    [cartItems, updateQuantity]
  );

  const handleRemove = useCallback((itemId: string) => {
    const item = cartItems.find((i) => String(i.id) === String(itemId));
    if (!item) return;
    removeFromCart(item.product_id);
  }, [cartItems, removeFromCart]);

  useEffect(() => {
    if (forceCheckout && itemCount > 0) {
      setCheckoutOpen(true);
      return;
    }
    setCheckoutOpen(false);
  }, [forceCheckout, itemCount]);

  useEffect(() => {
    if (!checkoutOpen) return;
    if (itemCount > 0) return;
    setCheckoutOpen(false);
    setCheckoutError("Your basket is empty. Add items before checking out.");
  }, [checkoutOpen, itemCount]);

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
          router.push(`/auth/login?next=${encodeURIComponent(cartRoute)}`);
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
  }, [cartRoute, router]);

  const fetchDefaultAddress = useCallback(async () => {
    try {
      const res = await requestWithCustomerAuth("/api/profile");
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as ProfileResponse;
      const addresses = Array.isArray(data.user?.addresses) ? data.user?.addresses : [];
      setSavedAddresses(addresses);
      const picked =
        addresses.find((a) => a?.is_default_shipping ?? a?.is_default) ??
        addresses.find((a) => a?.is_default) ??
        addresses[0];
      if (!picked) return;
      setSelectedAddressId(String(picked.id ?? ""));

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

  const applyAddressToForm = useCallback((address: AddressRow) => {
    const recipient = String(address.recipient_name ?? "").trim();
    const [first, ...rest] = recipient.split(/\s+/).filter(Boolean);
    const last = rest.join(" ");
    setAddressForm((prev) => ({
      ...prev,
      country: String(address.country ?? prev.country ?? "Malaysia"),
      firstName: first || prev.firstName,
      lastName: last || prev.lastName,
      address1: String(address.address_line1 ?? prev.address1),
      address2: String(address.address_line2 ?? prev.address2),
      city: String(address.city ?? prev.city),
      state: String(address.state ?? prev.state),
      postalCode: String(address.postal_code ?? prev.postalCode),
      phone: String(address.phone ?? prev.phone),
    }));
    setSelectedAddressId(String(address.id ?? ""));
  }, []);

  const onSaveEditedAddress = useCallback(() => {
    if (!selectedAddressId) {
      const fallbackId = savedAddresses[0]?.id ? String(savedAddresses[0].id) : null;
      if (!fallbackId) {
        setError("No address selected. Please choose an address first.");
        return;
      }
      setSelectedAddressId(fallbackId);
    }

    const effectiveId = selectedAddressId || String(savedAddresses[0]?.id ?? "");
    if (!effectiveId) {
      setError("No address selected. Please choose an address first.");
      return;
    }

    setSavedAddresses((prev) =>
      prev.map((address) => {
        if (String(address.id ?? "") !== effectiveId) return address;
        return {
          ...address,
          recipient_name: [addressForm.firstName, addressForm.lastName].filter(Boolean).join(" ").trim(),
          address_line1: addressForm.address1,
          address_line2: addressForm.address2,
          city: addressForm.city,
          state: addressForm.state,
          postal_code: addressForm.postalCode,
          country: addressForm.country,
          phone: addressForm.phone,
        };
      })
    );
    if (sameBillingAsShipping) {
      setBillingForm((prev) => ({
        ...prev,
        firstName: addressForm.firstName,
        lastName: addressForm.lastName,
        address1: addressForm.address1,
        address2: addressForm.address2,
        deliveryInstruction: addressForm.deliveryInstruction,
        city: addressForm.city,
        state: addressForm.state,
        postalCode: addressForm.postalCode,
        phone: addressForm.phone,
        country: addressForm.country,
      }));
    }
    setSuccess("Address updated.");
    playAddressSaveTransition();
  }, [
    addressForm.address1,
    addressForm.address2,
    addressForm.deliveryInstruction,
    addressForm.city,
    addressForm.country,
    addressForm.firstName,
    addressForm.lastName,
    addressForm.phone,
    addressForm.postalCode,
    addressForm.state,
    playAddressSaveTransition,
    sameBillingAsShipping,
    savedAddresses,
    selectedAddressId,
  ]);

  const onToggleAddressList = useCallback(() => {
    setError(null);
    setEditingCurrentAddress(false);
    setShowMyAddresses((prev) => !prev);
  }, []);

  const onToggleEditCurrent = useCallback(() => {
    setError(null);
    if (!selectedAddressId && savedAddresses.length > 0) {
      const fallback = savedAddresses[0];
      applyAddressToForm(fallback);
      setSelectedAddressId(String(fallback.id ?? ""));
    }
    if (!selectedAddressId && savedAddresses.length === 0) {
      setError("No saved address available. Please add a new address first.");
      return;
    }
    setShowMyAddresses(false);
    setEditingCurrentAddress((prev) => !prev);
  }, [applyAddressToForm, savedAddresses, selectedAddressId]);

  useEffect(() => {
    setMounted(true);
    if (process.env.NODE_ENV !== "production") {
      console.log("[cart][page] mounted");
    }
    setEmail(readEmailFromToken());
    setProfileName(readUsernameFromToken());
    const localCart = getCartFromLocalStorage();
    const hasLocalSnapshot = Boolean(localCart && localCart.items.length > 0);
    if (localCart) setCart(localCart);
    if (hasLocalSnapshot) setLoading(false);

    void fetchCart(hasLocalSnapshot);
    void fetchDefaultAddress();
  }, [fetchCart, fetchDefaultAddress]);

  useEffect(() => {
    return () => {
      clearTransitionTimers();
    };
  }, [clearTransitionTimers]);

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
  }, [cartRoute, router]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    const onOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-cart-profile-menu='true']")) {
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    window.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("mousedown", onOutside);
    };
  }, [profileMenuOpen]);

  const handleCheckout = async () => {
    setCheckoutError(null);
    if (cartItems.length === 0) {
      setCheckoutError("Your basket is empty. Add items before checking out.");
      setCheckoutOpen(false);
      return;
    }

    // Persist UI quantity changes to DB only at checkout time.
    await flushPendingQuantities();

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
        delivery_instruction: form.deliveryInstruction.trim() || null,
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
          delivery_method: deliveryMethodId,
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
        voucher_code: appliedDiscountCode ?? null,
        voucher_discount_amount: discountAmount,
        total_amount: total,
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
      setCart({ cart_id: cart?.cart_id ?? "", item_count: 0, subtotal: 0, items: [] });
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
                {(Number(order?.voucher_discount_amount ?? 0) > 0 || appliedDiscountCode) ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Voucher{order?.voucher_code ? ` (${order.voucher_code})` : ""}</span>
                    <span>-RM{Number(order?.voucher_discount_amount ?? 0).toFixed(2)}</span>
                  </div>
                ) : null}
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
    <div className="min-h-screen bg-[#F9F7F2] pb-16 text-[#2C1E1A]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="overflow-hidden rounded-[28px] border border-[#ddd2c2] bg-[#fcfbf8] shadow-[0_18px_50px_rgba(80,61,37,0.10)]">
          <div className="relative border-b border-[#e5dccf] px-5 py-5 sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden lg:block">
              <img src={CART_HERO_ORIGINAL_PHOTO} alt="" className="h-full w-full object-cover opacity-90" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(252,251,248,1)_0%,rgba(252,251,248,0.32)_48%,rgba(252,251,248,0)_100%)]" />
            </div>
            <div className="relative">
          <div className="mb-2 flex items-center justify-between border-b border-zinc-200/80 bg-transparent px-1 py-2">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="PAWLUXE logo" className="h-9 w-auto" />
            </div>
            <div className="relative" data-cart-profile-menu="true">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full bg-white px-2 py-1"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-700">
                  {profileBadge}
                </span>
                <span className="pr-1 text-xs font-medium text-zinc-700">{profileName}</span>
                <span className="text-xs text-zinc-500">v</span>
              </button>
              {profileMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-black/10 bg-white p-3 shadow-2xl">
                  <div className="space-y-1">
                    <Link
                      href="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
                    >
                      <span aria-hidden="true">👤</span>
                      Profile
                    </Link>
                    <Link
                      href="/address-book"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
                    >
                      <span aria-hidden="true">📍</span>
                      Address book
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        localStorage.removeItem("customer_jwt_token");
                        window.dispatchEvent(new Event("customer-auth-changed"));
                        router.replace("/auth/login");
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-left text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
                    >
                      <span aria-hidden="true">↪</span>
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mb-6 overflow-x-auto rounded-2xl border border-[#ded7cb] bg-white/85 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="mx-auto grid w-full max-w-3xl grid-cols-4 items-center gap-3 text-center text-sm">
              <div>
                <div className={`mx-auto mb-1 h-3 w-3 rounded-full ${checkoutOpen ? "bg-[#D4AF37]" : "bg-[#D4AF37] ring-2 ring-[#f3e7bd]"}`} />
                <p className={`${checkoutOpen ? "text-zinc-700" : "font-semibold text-black"}`}>Cart</p>
              </div>
              <div>
                <div className={`mx-auto mb-1 h-3 w-3 rounded-full ${checkoutOpen ? "bg-[#D4AF37] ring-2 ring-[#f3e7bd]" : "bg-[#D4AF37]"}`} />
                <p className={`${checkoutOpen ? "font-semibold text-black" : "text-zinc-700"}`}>Checkout</p>
              </div>
              <div>
                <div className="mx-auto mb-1 h-3 w-3 rounded-full bg-zinc-300" />
                <p className="text-zinc-400">Payment</p>
              </div>
              <div>
                <div className="mx-auto mb-1 h-3 w-3 rounded-full bg-zinc-300" />
                <p className="text-zinc-400">Confirmation</p>
              </div>
            </div>
            <div className="mx-auto -mt-10 grid w-full max-w-3xl grid-cols-3 gap-0 px-12">
              <span className="h-px bg-[#D4AF37]" />
              <span className="h-px bg-zinc-300" />
              <span className="h-px bg-zinc-300" />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#a78963]">
                {checkoutOpen ? "Checkout" : "Your Basket"}
              </p>
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-[#2C1E1A] sm:text-[3.35rem]">
                {checkoutOpen ? "Secure checkout" : "Your basket"}
              </h1>
              <p className="text-sm text-[#5b5147]">
                {checkoutOpen
                  ? "Review your details and place your order."
                  : `You have ${itemCount} item${itemCount === 1 ? "" : "s"} ready for your furry friend.`}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
              {checkoutOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    if (forceCheckout) {
                      router.push("/cart");
                      return;
                    }
                    setCheckoutOpen(false);
                  }}
                  className="rounded-full border border-[#d8cebf] bg-white px-5 py-2.5 text-sm font-semibold text-[#3b332c] transition hover:bg-[#f7f2eb]"
                >
                  {"<- Back to cart"}
                </button>
              ) : (
                <Link
                  href="/products"
                  className="rounded-full border border-[#d8cebf] bg-white px-5 py-2.5 text-sm font-semibold text-[#3b332c] transition hover:bg-[#f7f2eb]"
                >
                  Continue shopping
                </Link>
              )}
            </div>
          </div>
            </div>
          </div>

          {checkoutOpen && success ? (
            <div className="mx-5 mt-5 rounded-2xl border border-emerald-200 bg-[linear-gradient(90deg,_rgba(217,250,229,0.8),_rgba(232,255,243,0.95))] px-4 py-3 text-sm font-medium text-emerald-900 sm:mx-7">
              {success}
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 px-5 pb-5 lg:grid-cols-[1.55fr_1fr] sm:px-7 sm:pb-7">
            <section className="space-y-6">
              {!checkoutOpen ? (
                <>
                  <div className="space-y-4">
                    {cartItems.map((item, idx) => {
                      const badge = idx === 0 ? "Best seller" : idx === 1 ? "Organic materials" : idx === 2 ? "New" : undefined;
                      return (
                        <CartItemRow
                          key={item.id}
                          item={item}
                          badge={badge}
                          onDecrease={handleDecrease}
                          onIncrease={handleIncrease}
                          onRemove={handleRemove}
                        />
                      );
                    })}
                  </div>

                  {error ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
                  ) : null}

                  {checkoutError ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{checkoutError}</p>
                  ) : null}
                </>
              ) : null}

              {checkoutOpen ? (
                <>
                  <div className="rounded-[24px] border border-[#dad0c1] bg-white p-5 shadow-[0_10px_24px_rgba(58,44,28,0.08)] sm:p-6">
                <h2 className="text-xl font-semibold text-umber">Contact Information</h2>
                <div className="mt-4 rounded-xl border border-[#d7ccbc] bg-[#fcfaf6] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a78963]">Email address</p>
                  <p className="mt-1 text-base font-medium text-umber">{email}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold text-umber">Shipping Address</h2>
                <div className="mt-4 rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Address</p>
                      <p className="mt-2 text-3sm font-semibold text-zinc-900">
                        {[addressForm.firstName, addressForm.lastName].filter(Boolean).join(" ").trim() || "Recipient"}
                      </p>
                      <p className="mt-1 text-base leading-7 text-zinc-800">
                        {addressForm.address1 || "Address line 1"}
                        <br />
                        {addressForm.address2 || "Address line 2"}
                        <br />
                        {[addressForm.city, addressForm.state, addressForm.postalCode].filter(Boolean).join(" ") || "City State Postal"}
                        <br />
                        {addressForm.country || "MY"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleAddressList}
                      className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-2xl font-medium text-zinc-800 transition hover:bg-zinc-50"
                    >
                      Change Address v
                    </button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={onToggleEditCurrent}
                      className="rounded-xl border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      {editingCurrentAddress ? "Done" : "Edit Current"}
                    </button>
                  </div>
                </div>

                {showMyAddresses ? (
                  <div className="mt-4 rounded-2xl border border-zinc-300 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-900">My Addresses</p>
                      <button
                        type="button"
                        onClick={() => router.push("/address-book#add")}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        + Add New
                      </button>
                    </div>
                    {savedAddresses.length > 0 ? (
                      <div className="space-y-2">
                        {savedAddresses.map((address, idx) => {
                          const line = [
                            address.address_line1,
                            address.address_line2,
                            address.city,
                            address.state,
                            address.postal_code,
                          ]
                            .filter((x) => String(x ?? "").trim())
                            .join(", ");
                          return (
                            <button
                              key={String(address.id ?? idx)}
                              type="button"
                              onClick={() => {
                                applyAddressToForm(address);
                                setShowMyAddresses(false);
                                setEditingCurrentAddress(false);
                              }}
                              className={`w-full rounded-xl border px-3 py-2 text-left hover:bg-zinc-50 ${
                                selectedAddressId === String(address.id ?? idx) ? "border-cyan-500 bg-cyan-50/40" : "border-zinc-200"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 text-zinc-500">📍</span>
                                <div>
                                  <p className="text-sm font-semibold text-zinc-900">
                                    {address.label || "Address"} {address.is_default_shipping ? "* Default shipping" : ""}
                                  </p>
                                  <p className="text-xs text-zinc-600">{line || "Incomplete address"}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600">No saved addresses yet.</p>
                    )}
                  </div>
                ) : null}

                {editingCurrentAddress ? (
                  <div
                    className={`mt-4 space-y-3 rounded-2xl border bg-zinc-50 p-4 transition-all duration-300 ease-out ${
                      shippingCollapseFx
                        ? "max-h-0 -translate-y-2 overflow-hidden border-transparent p-0 opacity-0"
                        : "max-h-[960px] translate-y-0 border-zinc-300 opacity-100"
                    }`}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-300 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">First name</p>
                        <input
                          value={addressForm.firstName}
                          onChange={(event) => setAddressForm((prev) => ({ ...prev, firstName: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-zinc-300 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Last name</p>
                        <input
                          value={addressForm.lastName}
                          onChange={(event) => setAddressForm((prev) => ({ ...prev, lastName: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-300 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Address line 1</p>
                      <input
                        value={addressForm.address1}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, address1: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="rounded-xl border border-zinc-300 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Address line 2</p>
                      <input
                        value={addressForm.address2}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, address2: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-300 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">State</p>
                        <input
                          value={addressForm.state}
                          onChange={(event) => setAddressForm((prev) => ({ ...prev, state: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-zinc-300 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Postcode</p>
                        <input
                          value={addressForm.postalCode}
                          onChange={(event) => setAddressForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-300 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Phone Number</p>
                        <input
                          value={addressForm.phone}
                          onChange={(event) => setAddressForm((prev) => ({ ...prev, phone: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-zinc-300 bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Billing Address</p>
                        <input
                          value={billingForm.address1}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, address1: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onSaveEditedAddress}
                      className="mt-1 w-full rounded-xl bg-[#e79d12] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d88e08]"
                    >
                      Save Address
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => router.push("/address-book#add")}
                  className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl border border-zinc-300 bg-zinc-100/70 py-12 text-zinc-500 transition hover:bg-zinc-100"
                >
                  <span className="text-5xl leading-none">+</span>
                  <span className="mt-3 text-3sm font-medium">Add New Shipping Address</span>
                </button>

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
                  <p className="mt-3 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-umber/80">
                    Billing summary: {shippingSummary}
                  </p>
                ) : null}
                <div className="mt-4 rounded-xl border border-zinc-300 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Delivery Instruction</p>
                  <textarea
                    value={addressForm.deliveryInstruction}
                    onChange={(event) => setAddressForm((prev) => ({ ...prev, deliveryInstruction: event.target.value }))}
                    rows={3}
                    placeholder="e.g. Leave at front desk / call on arrival"
                    className="mt-1 w-full resize-none bg-transparent text-base text-umber outline-none placeholder:text-zinc-400"
                  />
                </div>
              </div>

              {sameBillingAsShipping ? (
              <div className="rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold text-umber">Delivery Method</h2>
                <div className="mt-4 rounded-xl border border-zinc-300 bg-white p-4">
                  <p className="text-base font-semibold text-zinc-900">Shipping Options</p>
                  <div className="mt-3 space-y-2">
                    <label
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 ${
                        deliveryMethodId === "west_my_standard" ? "border-zinc-400 bg-zinc-100" : "border-zinc-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="delivery-method"
                          checked={deliveryMethodId === "west_my_standard"}
                          onChange={() => setDeliveryMethodId("west_my_standard")}
                        />
                        <span className="text-sm font-medium text-zinc-900">West Malaysia Standard Shipping</span>
                      </div>
                      <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        RM 7.00
                      </span>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 ${
                        deliveryMethodId === "pickup_store" ? "border-zinc-400 bg-zinc-100" : "border-zinc-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="delivery-method"
                          checked={deliveryMethodId === "pickup_store"}
                          onChange={() => setDeliveryMethodId("pickup_store")}
                        />
                        <span className="text-sm font-medium text-zinc-900">Pickup In Store (2-3 Working days)</span>
                      </div>
                      <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        FREE
                      </span>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 ${
                        deliveryMethodId === "pickup_express" ? "border-zinc-400 bg-zinc-100" : "border-zinc-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="delivery-method"
                          checked={deliveryMethodId === "pickup_express"}
                          onChange={() => setDeliveryMethodId("pickup_express")}
                        />
                        <span className="text-sm font-medium text-zinc-900">Pickup Express</span>
                      </div>
                      <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        FREE
                      </span>
                    </label>
                  </div>

                  {(deliveryMethodId === "pickup_store" || deliveryMethodId === "pickup_express") ? (
                    <>
                      <div className="mt-3">
                        <select
                          value={pickupLocation}
                          onChange={(event) => setPickupLocation(event.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                        >
                          <option value="">Select Location</option>
                          <option value="59-G (GROUND FLOOR), JALAN PRIMA SG 3/1, PRIMA SRI GOMBAK, BATU CAVES - 68100">
                            Prima Sri Gombak
                          </option>
                        </select>
                      </div>
                      {pickupLocation ? (
                        <p className="mt-3 text-sm font-semibold text-zinc-900">
                          Pick Up Address: <span className="font-normal">{pickupLocation}</span>
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
              ) : null}

              {!sameBillingAsShipping ? (
                <>
                <div className="rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-semibold text-umber">Billing Address</h2>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Country/Region</p>
                      <input
                        value={billingForm.country}
                        onChange={(event) => setBillingForm((prev) => ({ ...prev, country: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">First name</p>
                        <input
                          value={billingForm.firstName}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, firstName: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Last name</p>
                        <input
                          value={billingForm.lastName}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, lastName: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Address</p>
                      <input
                        value={billingForm.address1}
                        onChange={(event) => setBillingForm((prev) => ({ ...prev, address1: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Apartment, suite, etc.</p>
                      <input
                        value={billingForm.address2}
                        onChange={(event) => setBillingForm((prev) => ({ ...prev, address2: event.target.value }))}
                        className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">City</p>
                        <input
                          value={billingForm.city}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, city: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">Postal code</p>
                        <input
                          value={billingForm.postalCode}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta">State/Region</p>
                        <input
                          value={billingForm.state}
                          onChange={(event) => setBillingForm((prev) => ({ ...prev, state: event.target.value }))}
                          className="mt-1 w-full bg-transparent text-base text-umber outline-none"
                        />
                      </div>
                      <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
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
                <div className="rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-semibold text-umber">Delivery Method</h2>
                  <div className="mt-4 rounded-xl border border-zinc-300 bg-white p-4">
                    <p className="text-base font-semibold text-zinc-900">Shipping Options</p>
                    <div className="mt-3 space-y-2">
                      <label
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 ${
                          deliveryMethodId === "west_my_standard" ? "border-zinc-400 bg-zinc-100" : "border-zinc-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="delivery-method"
                            checked={deliveryMethodId === "west_my_standard"}
                            onChange={() => setDeliveryMethodId("west_my_standard")}
                          />
                          <span className="text-sm font-medium text-zinc-900">West Malaysia Standard Shipping</span>
                        </div>
                        <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          RM 7.00
                        </span>
                      </label>

                      <label
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 ${
                          deliveryMethodId === "pickup_store" ? "border-zinc-400 bg-zinc-100" : "border-zinc-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="delivery-method"
                            checked={deliveryMethodId === "pickup_store"}
                            onChange={() => setDeliveryMethodId("pickup_store")}
                          />
                          <span className="text-sm font-medium text-zinc-900">Pickup In Store (2-3 Working days)</span>
                        </div>
                        <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          FREE
                        </span>
                      </label>

                      <label
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 ${
                          deliveryMethodId === "pickup_express" ? "border-zinc-400 bg-zinc-100" : "border-zinc-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="delivery-method"
                            checked={deliveryMethodId === "pickup_express"}
                            onChange={() => setDeliveryMethodId("pickup_express")}
                          />
                          <span className="text-sm font-medium text-zinc-900">Pickup Express</span>
                        </div>
                        <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          FREE
                        </span>
                      </label>
                    </div>

                    {(deliveryMethodId === "pickup_store" || deliveryMethodId === "pickup_express") ? (
                      <>
                        <div className="mt-3">
                          <select
                            value={pickupLocation}
                            onChange={(event) => setPickupLocation(event.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                          >
                            <option value="">Select Location</option>
                            <option value="59-G (GROUND FLOOR), JALAN PRIMA SG 3/1, PRIMA SRI GOMBAK, BATU CAVES - 68100">
                              Prima Sri Gombak
                            </option>
                          </select>
                        </div>
                        {pickupLocation ? (
                          <p className="mt-3 text-sm font-semibold text-zinc-900">
                            Pick Up Address: <span className="font-normal">{pickupLocation}</span>
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                </>
              ) : null}

              <div className="rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm sm:p-6">
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
                            ? "border-cyan-500 bg-cyan-50/40 shadow-sm"
                            : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50"
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
                                <span className="rounded-full bg-cyan-600 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
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

                <div className="mt-4 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3">
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
                </>
              ) : null}
            </section>

            <aside className="hidden h-fit rounded-[24px] border border-[#ddd2c2] bg-white p-4 shadow-[0_12px_28px_rgba(58,44,28,0.08)] sm:p-4 lg:sticky lg:top-24 lg:block">
              <div className="rounded-[20px] border border-[#e1d8cb] bg-white p-4 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[1.85rem] font-semibold tracking-tight text-zinc-900">Order Summary</h3>
                    <p className="mt-1 text-sm text-zinc-500">{itemCount} items in your cart</p>
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    MYR
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {cartItems.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="flex items-center justify-between gap-4 border-b border-[#eee5d8] pb-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-umber">{item.product.name}</p>
                        <p className="mt-1 text-xs font-semibold text-umber/55">
                          RM{Number(item.unit_price).toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-umber">
                        RM{(item.unit_price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                    <span className="text-zinc-600">Spend RM {freeShippingRemaining.toFixed(2)} more to unlock FREE Shipping</span>
                    <span className="text-[#D4AF37]">{freeShippingProgress}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#f3ead0]">
                    <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${freeShippingProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-[#D4AF37]">{freeShippingRemaining > 0 ? "In progress" : "Unlocked"}</p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5">
                    <label htmlFor="discount-code" className="text-xs font-semibold text-zinc-500">
                      Enter Voucher Code Here
                    </label>
                    <input
                      id="discount-code"
                      value={discountCode}
                      onChange={(event) => setDiscountCode(event.target.value)}
                      placeholder="Enter code"
                      className="mt-1 w-full bg-transparent text-sm font-medium text-zinc-800 outline-none placeholder:text-zinc-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyDiscountCode}
                    className="min-h-[46px] rounded-lg border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Apply
                  </button>
                </div>
                {discountMessage ? <p className="mt-2 text-xs text-orange-500">{discountMessage}</p> : null}

                <div className="mt-5 space-y-3 border-t border-[#eee5d8] pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-umber/70">Subtotal</span>
                    <span className="font-semibold text-umber">
                      RM{subtotal.toFixed(2)} <span className="text-umber/50">· {itemCount} items</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-umber/70">
                      <span>Shipping</span>
                      <button
                        type="button"
                        onClick={() => setShippingInfoOpen(true)}
                        aria-label="Shipping info"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-umber/30 text-[11px] font-bold text-umber/50 transition hover:bg-umber/5"
                      >
                        ?
                      </button>
                    </div>
                    <span className="font-semibold text-umber/70">
                      {checkoutOpen
                        ? addressForm.address1.trim()
                          ? `RM${shippingEstimate.toFixed(2)}`
                          : "Enter shipping address"
                        : "Calculated at checkout"}
                    </span>
                  </div>
                  {discountAmount > 0 ? (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-umber/70">
                        Voucher Discount{appliedDiscountCode ? ` (${appliedDiscountCode})` : ""}
                      </span>
                      <span className="font-semibold text-sage">-RM{discountAmount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-4 border-t border-[#eee5d8] pt-3">
                    <span className="text-lg font-semibold text-umber">Total</span>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-umber/50">MYR</p>
                      <p className="text-2xl font-bold tracking-tight text-umber">RM{total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {!checkoutOpen ? (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        if (itemCount <= 0) {
                          setCheckoutError("Your basket is empty. Add items before checking out.");
                          return;
                        }
                        if (forceCheckout) {
                          setCheckoutOpen(true);
                          return;
                        }
                        router.push("/checkout");
                      }}
                      className="w-full rounded-xl bg-[#2C1E1A] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(44,30,26,0.24)] transition hover:brightness-95"
                    >
                      Proceed to checkout</button>
                    <p className="mt-3 text-center text-[11px] leading-relaxed text-umber/50">
                      By proceeding, you agree to our terms of service and shipping policies.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handleCheckout()}
                      disabled={checkingOut}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {checkingOut ? "Processing..." : "Proceed to checkout"}
                    </button>
                    <p className="mt-3 text-xs text-umber/55">Shipping and tax are confirmed at the next step.</p>
                  </div>
                )}
              </div>
              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}
              {checkoutError ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{checkoutError}</p>
              ) : null}
            </aside>
          </div>
          <div className="border-t border-[#e5dccf] bg-[#f8f2e8] px-5 py-4 pb-32 sm:px-7 sm:py-5 lg:pb-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#e6dbca] bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-[#3f2f20]">Free Shipping</p>
                <p className="text-xs text-[#7a6650]">On orders over RM49</p>
              </div>
              <div className="rounded-2xl border border-[#e6dbca] bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-[#3f2f20]">30-Day Returns</p>
                <p className="text-xs text-[#7a6650]">Hassle-free returns</p>
              </div>
              <div className="rounded-2xl border border-[#e6dbca] bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-[#3f2f20]">24/7 Support</p>
                <p className="text-xs text-[#7a6650]">We&apos;re here to help</p>
              </div>
              <div className="rounded-2xl border border-[#e6dbca] bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-[#3f2f20]">Trusted by Pet Parents</p>
                <p className="text-xs text-[#7a6650]">10,000+ happy pets</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {!checkoutOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2d8c8] bg-[linear-gradient(180deg,#ffffff_0%,#f7f1e8_100%)] p-3 shadow-[0_-8px_24px_rgba(44,30,26,0.12)] lg:hidden">
          <div className="mx-auto max-w-6xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#2C1E1A]">Total</span>
              <span className="text-lg font-bold text-[#2C1E1A]">RM{total.toFixed(2)}</span>
            </div>
            <div className="mb-2 rounded-full bg-[#f3ead0]">
              <div className="h-1.5 rounded-full bg-[#D4AF37]" style={{ width: `${freeShippingProgress}%` }} />
            </div>
            <button
              type="button"
              onClick={() => {
                if (itemCount <= 0) {
                  setCheckoutError("Your basket is empty. Add items before checking out.");
                  return;
                }
                if (forceCheckout) {
                  setCheckoutOpen(true);
                  return;
                }
                router.push("/checkout");
              }}
              className="min-h-[48px] w-full rounded-[20px] bg-[#2C1E1A] px-6 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(44,30,26,0.24)]"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      ) : null}
      {shippingInfoOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[480px] rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">Shipping</h3>
              <button
                type="button"
                onClick={() => setShippingInfoOpen(false)}
                aria-label="Close shipping info"
                className="text-3xl leading-none text-zinc-500 transition hover:text-zinc-700"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-base leading-[1.5] text-zinc-800 sm:text-[1.75rem]">
              Your order will be shipped out in 2 working days and you will receive an email with tracking number and courier used. Delivery usually takes 5-12 days from the shipped date, excluding holidays.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CartPage() {
  return <CartPageContent />;
}


