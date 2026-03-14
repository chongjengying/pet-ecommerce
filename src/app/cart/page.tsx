"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, cartCount } = useCart();

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (cartCount === 0) {
    return (
      <div className="bg-cream">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-terracotta">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-umber">Your cart is empty</h2>
          <p className="mt-2 text-umber/70">Add some products and come back.</p>
          <Link
            href="/products"
            className="mt-8 inline-block rounded-xl bg-terracotta px-6 py-3 text-sm font-semibold text-white hover:bg-terracotta/90"
          >
            Shop products
          </Link>
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
                  src={`https://picsum.photos/200/200?random=${item.id}`}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-umber">{item.name}</h3>
                <p className="text-sm text-umber/70">${item.price.toFixed(2)} each</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-umber hover:bg-amber-50"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-umber hover:bg-amber-50"
                    aria-label="Increase"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="ml-2 text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="text-right font-semibold text-umber sm:text-lg">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-amber-200/60 bg-white p-6">
          <div className="flex justify-between text-lg font-semibold text-umber">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-sm text-umber/60">Shipping and tax calculated at checkout.</p>
          <button
            type="button"
            className="mt-6 w-full rounded-xl bg-terracotta py-3.5 text-base font-semibold text-white shadow-md hover:bg-terracotta/90 sm:w-auto sm:px-12"
          >
            Proceed to checkout
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
