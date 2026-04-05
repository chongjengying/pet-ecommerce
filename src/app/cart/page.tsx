"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { useState } from "react";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, cartCount, clearCart } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutSignInHint, setCheckoutSignInHint] = useState(false);

  const handleCheckout = async () => {
    setCheckoutError(null);
    setCheckoutSignInHint(false);
    setCheckingOut(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            quantity: i.quantity,
            name: i.name,
            price: i.price,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCheckoutError(data?.error ?? "Checkout failed");
        setCheckoutSignInHint(!token || res.status === 401);
        return;
      }
      clearCart();
      setCheckoutSuccess(true);
    } catch {
      setCheckoutError("Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (cartCount === 0) {
    return (
      <div className="bg-cream">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          {checkoutSuccess ? (
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage/20 text-sage">
                <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-umber">Thank you!</h2>
              <p className="mt-2 text-umber/70">Your order has been placed and stock has been updated.</p>
              <Link
                href="/products"
                className="mt-8 inline-block rounded-xl bg-terracotta px-6 py-3 text-sm font-semibold text-white hover:bg-terracotta/90"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200/60 bg-white p-8 shadow-sm">
              <h1 className="text-xl font-bold text-umber sm:text-2xl">Shopping Cart (0)</h1>
              <div className="mt-10 flex flex-col items-center justify-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-umber/60">
                  <svg className="h-14 w-14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="mt-6 text-lg font-bold text-umber">Your cart is currently empty!</p>
                <p className="mt-2 text-sm text-umber/70">You may check out all the available products and buy some in the shop.</p>
                <Link
                  href="/products"
                  className="mt-8 w-full max-w-xs rounded-xl bg-umber px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-umber/90 sm:w-auto"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-umber">Cart</h1>
        <p className="mt-1 text-umber/70">{cartCount} item{cartCount !== 1 ? "s" : ""}</p>

        <div className="mt-8 space-y-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-2xl border border-amber-200/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-amber-50 sm:h-28 sm:w-28">
                <Image
                  src={item.image ?? item.image_url ?? `https://picsum.photos/200/200?random=${item.id}`}
                  alt={item.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-umber">{item.name}</h3>
                <p className="text-sm text-umber/70">RM{item.price.toFixed(2)} each</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(String(item.id), item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-umber hover:bg-amber-50"
                    aria-label={item.quantity === 1 ? "Remove item" : "Decrease quantity"}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(String(item.id), item.quantity + 1)}
                    disabled={typeof item.stock === "number" && item.quantity >= item.stock}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-umber hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(String(item.id))}
                    className="ml-2 text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="text-right font-semibold text-umber sm:text-lg">
                RM{(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-amber-200/60 bg-white p-6">
          <div className="flex justify-between text-lg font-semibold text-umber">
            <span>Subtotal</span>
            <span>RM{subtotal.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-sm text-umber/60">Shipping and tax calculated at checkout.</p>
          {checkoutError && (
            <div className="mt-4 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              <p>{checkoutError}</p>
              {checkoutSignInHint ? (
                <p className="text-xs font-normal text-red-800/90">
                  <Link href="/auth/login?next=/profile" className="font-semibold underline underline-offset-2">
                    Sign in
                  </Link>{" "}
                  and save your shipping address on your profile before checking out.
                </p>
              ) : null}
            </div>
          )}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={checkingOut}
            className="mt-6 w-full rounded-xl bg-terracotta py-3.5 text-base font-semibold text-white shadow-md hover:bg-terracotta/90 disabled:opacity-70 sm:w-auto sm:px-12"
          >
            {checkingOut ? "Processing…" : "Proceed to checkout"}
          </button>
        </div>

        <Link
          href="/products"
          className="mt-6 inline-block text-sm font-medium text-terracotta hover:underline"
        >
          ← Continue shopping
        </Link>
      </div>
    </div>
  );
}
