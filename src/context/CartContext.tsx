"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product, CartItem } from "@/types";

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  cartCount: number;
  clearCart: () => void;
  flyoutOpen: boolean;
  openCartFlyout: () => void;
  closeCartFlyout: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function getStockLimit(item: Pick<Product, "stock"> | Pick<CartItem, "stock">): number | undefined {
  if (item.stock == null) return undefined;
  const n = Number(item.stock);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.floor(n));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    const requestedQty = Math.max(1, Math.floor(Number(quantity)));
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) return;
    const id = String(product.id);
    const normalized = { ...product, id };
    let didAdd = false;
    setItems((prev) => {
      const existing = prev.find((i) => String(i.id) === id);
      const stockLimit = getStockLimit(product) ?? getStockLimit(existing ?? normalized);

      if (stockLimit !== undefined && stockLimit <= 0) return prev;

      if (existing) {
        const nextQtyRaw = existing.quantity + requestedQty;
        const nextQty = stockLimit !== undefined ? Math.min(nextQtyRaw, stockLimit) : nextQtyRaw;
        if (nextQty === existing.quantity) return prev;
        didAdd = true;
        return prev.map((i) => (String(i.id) === id ? { ...i, quantity: nextQty } : i));
      }

      const initialQty = stockLimit !== undefined ? Math.min(requestedQty, stockLimit) : requestedQty;
      if (initialQty <= 0) return prev;
      didAdd = true;
      return [...prev, { ...normalized, quantity: initialQty }];
    });
    if (didAdd) setFlyoutOpen(true);
  }, []);

  const openCartFlyout = useCallback(() => setFlyoutOpen(true), []);
  const closeCartFlyout = useCallback(() => setFlyoutOpen(false), []);

  const removeFromCart = useCallback((productId: string) => {
    const id = String(productId);
    setItems((prev) => prev.filter((i) => String(i.id) !== id));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const id = String(productId);
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => String(i.id) !== id));
      return;
    }
    setItems((prev) => {
      const target = prev.find((i) => String(i.id) === id);
      if (!target) return prev;

      const stockLimit = getStockLimit(target);
      if (stockLimit !== undefined && stockLimit <= 0) {
        return prev.filter((i) => String(i.id) !== id);
      }

      const requestedQty = Math.max(1, Math.floor(Number(quantity)));
      const nextQty = stockLimit !== undefined ? Math.min(requestedQty, stockLimit) : requestedQty;
      if (nextQty === target.quantity) return prev;

      return prev.map((i) => (String(i.id) === id ? { ...i, quantity: nextQty } : i));
    });
  }, []);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const clearCart = useCallback(() => setItems([]), []);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        cartCount,
        clearCart,
        flyoutOpen,
        openCartFlyout,
        closeCartFlyout,
      }}
    >
      {children}
      {/* Cart flyout overlay */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${flyoutOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!flyoutOpen}
      >
        <button
          type="button"
          aria-label="Close cart"
          className="absolute inset-0 bg-umber/40 backdrop-blur-[2px]"
          onClick={closeCartFlyout}
        />
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform duration-300 ease-out sm:max-w-sm ${flyoutOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-amber-200/60 px-4 py-4">
              <h2 className="text-xl font-bold text-umber">
                Shopping Cart ({cartCount})
              </h2>
              <button
                type="button"
                onClick={closeCartFlyout}
                className="flex h-9 w-9 items-center justify-center rounded-full text-umber/60 hover:bg-amber-100 hover:text-umber"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {cartCount === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-umber/60">
                    <svg className="h-14 w-14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="mt-6 text-lg font-bold text-umber">Your cart is currently empty!</p>
                  <p className="mt-2 text-sm text-umber/70">You may check out all the available products and buy some in the shop.</p>
                </div>
              ) : (
                <ul className="divide-y divide-amber-100 px-4 py-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-3 py-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-amber-50">
                        <Image
                          src={item.image ?? `https://picsum.photos/200/200?random=${item.id}`}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-umber line-clamp-2">{item.name}</h3>
                        <p className="mt-0.5 text-sm text-umber/70">RM{item.price.toFixed(2)} each</p>
                        <div className="mt-2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(String(item.id), item.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded border border-amber-200 text-umber hover:bg-amber-50"
                            aria-label={item.quantity === 1 ? "Remove item" : "Decrease"}
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(String(item.id), item.quantity + 1)}
                            disabled={typeof item.stock === "number" && item.quantity >= item.stock}
                            className="flex h-7 w-7 items-center justify-center rounded border border-amber-200 text-umber hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Increase"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(String(item.id))}
                            className="ml-2 text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold text-umber">
                        RM{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-amber-200/60 bg-cream/50 p-4">
              {cartCount > 0 && (
                <div className="mb-4 flex justify-between text-base font-semibold text-umber">
                  <span>Subtotal</span>
                  <span>RM{subtotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={closeCartFlyout}
                  className="w-full rounded-xl border border-amber-200 bg-white py-2.5 text-sm font-medium text-umber hover:bg-amber-50"
                >
                  Continue Shopping
                </button>
                <Link
                  href="/cart"
                  onClick={closeCartFlyout}
                  className="block w-full rounded-xl bg-umber py-2.5 text-center text-sm font-semibold text-white hover:bg-umber/90"
                >
                  {cartCount === 0 ? "View cart" : "View cart & checkout"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (ctx === undefined) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
