"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, startTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product, CartItem } from "@/types";

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => Promise<boolean>;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  cartCount: number;
  clearCart: () => void;
  flyoutOpen: boolean;
  openCartFlyout: () => void;
  closeCartFlyout: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

type ServerCartItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price?: number | null;
  price_at_time?: number | null;
  product: {
    id: string;
    name: string;
    image: string | null;
    image_url: string | null;
    stock: number | null;
  };
};

type ServerCartResponse = {
  cart_id?: string;
  item_count?: number;
  subtotal?: number;
  items?: ServerCartItem[];
};
type CartItemPatchResponse = {
  item?: {
    id?: string | number;
    quantity?: number;
  };
  totals?: { subtotal?: number; grand_total?: number };
  error?: string;
};

const CART_SNAPSHOT_KEY = "customer_cart_snapshot";
const QTY_ACTION_MIN_LOCK_MS = 300;
const QTY_LOADING_DELAY_MS = 200;
const QTY_SUCCESS_BADGE_MS = 900;

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("customer_jwt_token");
}

async function requestCartApi(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = readToken();
  const headers = new Headers(init.headers ?? undefined);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  // If localStorage token is stale but the auth cookie is still valid,
  // retry once without the bearer header so server-side cookie auth can work.
  if (response.status === 401 && token && headers.has("Authorization")) {
    const retryHeaders = new Headers(headers);
    retryHeaders.delete("Authorization");
    response = await fetch(input, {
      ...init,
      headers: retryHeaders,
      credentials: "same-origin",
    });
  }

  return response;
}

function mapServerItemsToCartItems(serverItems: ServerCartItem[]): CartItem[] {
  const mapped: CartItem[] = [];
  for (const row of serverItems) {
    const product =
      row?.product && typeof row.product === "object"
        ? row.product
        : ({
            id: String(row?.product_id ?? ""),
            name: "Product",
            image: null,
            image_url: null,
            stock: null,
          } as ServerCartItem["product"]);

    const id = String(row?.product_id ?? product.id ?? "").trim();
    if (!id) continue;

    mapped.push({
      id,
      name: String(product.name ?? "Product"),
      price: Number(row?.unit_price ?? row?.price_at_time ?? 0),
      image: product.image ?? undefined,
      image_url: product.image_url ?? undefined,
      stock: product.stock ?? undefined,
      quantity: Math.max(1, Math.floor(Number(row?.quantity ?? 1))),
    });
  }
  return mapped;
}

function persistCartSnapshot(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    const snapshot = {
      items,
      item_count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      saved_at: Date.now(),
    };
    window.localStorage.setItem(CART_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures and keep cart usable.
  }
}

function getStockLimit(item: Pick<Product, "stock"> | Pick<CartItem, "stock">): number | undefined {
  if (item.stock == null) return undefined;
  const n = Number(item.stock);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.floor(n));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [qtyActionPendingById, setQtyActionPendingById] = useState<Record<string, boolean>>({});
  const [qtyLoadingVisibleById, setQtyLoadingVisibleById] = useState<Record<string, boolean>>({});
  const [qtySuccessVisibleById, setQtySuccessVisibleById] = useState<Record<string, boolean>>({});
  const qtyLoadingTimerRef = useRef<Record<string, number>>({});
  const qtySuccessTimerRef = useRef<Record<string, number>>({});
  const flyoutContainerRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const refreshFromServer = useCallback(async () => {
    const debugLabel = `[cart][context] GET /api/cart`;
    const startedAt = Date.now();
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log(`${debugLabel} start`, { startedAt });
      }
      const res = await requestCartApi("/api/cart");
      const data = (await res.json().catch(() => ({}))) as ServerCartResponse & { error?: string };
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
          setItems([]);
        }
        return;
      }
      const nextItems = Array.isArray(data.items) ? mapServerItemsToCartItems(data.items) : [];
      startTransition(() => {
        setItems(nextItems);
      });
      persistCartSnapshot(nextItems);
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.log(`${debugLabel} network/error`, { elapsedMs: Date.now() - startedAt });
      }
      // Keep current in-memory cart if sync fails transiently.
    }
  }, []);

  useEffect(() => {
    const initSync = window.setTimeout(() => {
      void refreshFromServer();
    }, 0);

    const onAuthChanged = () => void refreshFromServer();
    const onCartChanged = () => void refreshFromServer();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "customer_jwt_token") {
        void refreshFromServer();
      }
    };
    window.addEventListener("customer-auth-changed", onAuthChanged);
    window.addEventListener("cart-changed", onCartChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(initSync);
      window.removeEventListener("customer-auth-changed", onAuthChanged);
      window.removeEventListener("cart-changed", onCartChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshFromServer]);

  useEffect(() => {
    return () => {
      const timers = qtyLoadingTimerRef.current;
      for (const key of Object.keys(timers)) {
        window.clearTimeout(timers[key]);
      }
      qtyLoadingTimerRef.current = {};
      const successTimers = qtySuccessTimerRef.current;
      for (const key of Object.keys(successTimers)) {
        window.clearTimeout(successTimers[key]);
      }
      qtySuccessTimerRef.current = {};
    };
  }, []);

  const addToCart = useCallback(async (product: Product, quantity = 1): Promise<boolean> => {
    const beforeItems = items;
    const requestedQty = Math.max(1, Math.floor(Number(quantity)));
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) return false;
    const token = readToken();
    const id = String(product.id);
    const normalized = { ...product, id };
    const existing = items.find((i) => String(i.id) === id);
    const stockLimit = getStockLimit(product) ?? getStockLimit(existing ?? normalized);
    const existingQty = existing?.quantity ?? 0;
    if (stockLimit !== undefined) {
      const remaining = Math.max(0, stockLimit - existingQty);
      if (remaining <= 0) return false;
      if (requestedQty > remaining) return false;
    }

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
    if (!didAdd) return false;

    const optimisticItems = (() => {
      if (stockLimit !== undefined && stockLimit <= 0) return items;
      if (existing) {
        const nextQty = existing.quantity + requestedQty;
        return items.map((i) => (String(i.id) === id ? { ...i, quantity: nextQty } : i));
      }
      return [...items, { ...normalized, quantity: requestedQty }];
    })();
    persistCartSnapshot(optimisticItems);

    setFlyoutOpen(true);

    if (token) {
      void (async () => {
        try {
          const res = await requestCartApi("/api/cart/items", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId: id,
              quantity: requestedQty,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as ServerCartResponse & { error?: string };
          if (!res.ok) {
            startTransition(() => {
              setItems(beforeItems);
            });
            persistCartSnapshot(beforeItems);
            return;
          }
          if (Array.isArray(data.items)) {
            const nextItems = mapServerItemsToCartItems(data.items ?? []);
            startTransition(() => {
              setItems(nextItems);
            });
            persistCartSnapshot(nextItems);
            return;
          }
        } catch {
          startTransition(() => {
            setItems(beforeItems);
          });
          persistCartSnapshot(beforeItems);
        }
      })();
      return true;
    }

    return true;
  }, [items]);

  const openCartFlyout = useCallback(() => setFlyoutOpen(true), []);
  const closeCartFlyout = useCallback(() => setFlyoutOpen(false), []);

  useEffect(() => {
    if (flyoutOpen) {
      const active = document.activeElement;
      lastFocusedElementRef.current = active instanceof HTMLElement ? active : null;
      return;
    }

    const container = flyoutContainerRef.current;
    const active = document.activeElement;
    if (container && active instanceof HTMLElement && container.contains(active)) {
      active.blur();
    }

    const previous = lastFocusedElementRef.current;
    if (previous && document.contains(previous)) {
      previous.focus();
    }
  }, [flyoutOpen]);

  const removeFromCart = useCallback((productId: string) => {
    const id = String(productId);
    const beforeItems = items;
    let optimisticItems: CartItem[] = [];
    setItems((prev) => {
      optimisticItems = prev.filter((i) => String(i.id) !== id);
      return optimisticItems;
    });
    persistCartSnapshot(optimisticItems);

    void (async () => {
      try {
        const res = await requestCartApi(`/api/cart/items/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setQtySuccessVisibleById((prev) => ({ ...prev, [id]: true }));
          if (qtySuccessTimerRef.current[id]) {
            window.clearTimeout(qtySuccessTimerRef.current[id]);
          }
          qtySuccessTimerRef.current[id] = window.setTimeout(() => {
            setQtySuccessVisibleById((prev) => {
              if (!(id in prev)) return prev;
              const next = { ...prev };
              delete next[id];
              return next;
            });
            delete qtySuccessTimerRef.current[id];
          }, QTY_SUCCESS_BADGE_MS);
          return;
        }
      } catch {
        // Keep optimistic local state; next refresh can reconcile.
      }
      startTransition(() => {
        setItems(beforeItems);
      });
      persistCartSnapshot(beforeItems);
    })();
  }, [items]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const beforeItems = items;
    const id = String(productId);
    const requestedQty = Math.max(0, Math.floor(Number(quantity)));
    const targetItem = items.find((i) => String(i.id) === id);
    const stockLimit = targetItem ? getStockLimit(targetItem) : undefined;
    const cappedQty =
      requestedQty <= 0
        ? 0
        : (stockLimit !== undefined ? Math.min(requestedQty, stockLimit) : requestedQty);
    const isIncreaseAction = cappedQty > (targetItem?.quantity ?? 0);
    const reqLabel = `[cart][qty] id=${id} from=${targetItem?.quantity ?? "n/a"} to=${cappedQty}`;

    let optimisticItems: CartItem[] = [];
    setItems((prev) => {
      if (quantity <= 0) {
        optimisticItems = prev.filter((i) => String(i.id) !== id);
        return optimisticItems;
      }

      const target = prev.find((i) => String(i.id) === id);
      if (!target) {
        optimisticItems = prev;
        return prev;
      }

      const targetStockLimit = getStockLimit(target);
      if (targetStockLimit !== undefined && targetStockLimit <= 0) {
        optimisticItems = prev.filter((i) => String(i.id) !== id);
        return optimisticItems;
      }

      const nextQty = targetStockLimit !== undefined ? Math.min(requestedQty, targetStockLimit) : requestedQty;
      if (nextQty === target.quantity) {
        optimisticItems = prev;
        return prev;
      }

      optimisticItems = prev.map((i) => (String(i.id) === id ? { ...i, quantity: nextQty } : i));
      return optimisticItems;
    });
    persistCartSnapshot(optimisticItems);
    const startedAt = Date.now();
    setQtyActionPendingById((prev) => ({ ...prev, [id]: true }));
    if (!isIncreaseAction) {
      qtyLoadingTimerRef.current[id] = window.setTimeout(() => {
        setQtyLoadingVisibleById((prev) => ({ ...prev, [id]: true }));
      }, QTY_LOADING_DELAY_MS);
    }

    void (async () => {
      try {
        if (process.env.NODE_ENV !== "production") {
          console.time(reqLabel);
          console.log(`${reqLabel} start`, { requestedQty, cappedQty, isIncreaseAction });
        }
        const res =
          cappedQty <= 0
            ? await requestCartApi(`/api/cart/items/${encodeURIComponent(id)}`, {
                method: "DELETE",
              })
            : await requestCartApi(`/api/cart/items/${encodeURIComponent(id)}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  quantity: cappedQty,
                }),
              });
        const data = (await res.json().catch(() => ({}))) as
          | (ServerCartResponse & { error?: string })
          | CartItemPatchResponse;
        if (process.env.NODE_ENV !== "production") {
          console.log(`${reqLabel} response`, {
            ok: res.ok,
            status: res.status,
            itemCount: "items" in data && Array.isArray(data.items) ? data.items.length : null,
            hasItem: "item" in data ? Boolean(data.item) : null,
            totals: "totals" in data ? data.totals ?? null : null,
            error: ("error" in data ? data.error : null) ?? null,
          });
        }
        if (res.ok) {
          const patchedQty =
            cappedQty > 0 && "item" in data && data.item
              ? Math.max(1, Math.floor(Number(data.item.quantity ?? cappedQty)))
              : cappedQty;
          if (cappedQty > 0) {
            setItems((prev) => {
              const next = prev.map((row) => {
                if (String(row.id) !== id) return row;
                return {
                  ...row,
                  quantity: patchedQty,
                };
              });
              persistCartSnapshot(next);
              return next;
            });
          }
          return;
        }
        startTransition(() => {
          setItems(beforeItems);
        });
        persistCartSnapshot(beforeItems);
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console.log(`${reqLabel} network/error`);
        }
        startTransition(() => {
          setItems(beforeItems);
        });
        persistCartSnapshot(beforeItems);
      } finally {
        if (process.env.NODE_ENV !== "production") {
          console.timeEnd(reqLabel);
        }
      }
    })().finally(() => {
      const loadingTimer = qtyLoadingTimerRef.current[id];
      if (loadingTimer) {
        window.clearTimeout(loadingTimer);
        delete qtyLoadingTimerRef.current[id];
      }
      setQtyLoadingVisibleById((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, QTY_ACTION_MIN_LOCK_MS - elapsed);
      window.setTimeout(() => {
        setQtyActionPendingById((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, remaining);
    });
  }, [items]);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const clearCart = useCallback(() => {
    setItems([]);
    persistCartSnapshot([]);
  }, []);
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
        ref={flyoutContainerRef}
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${flyoutOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        inert={!flyoutOpen}
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
                        {qtyLoadingVisibleById[String(item.id)] ? (
                          <p className="mt-1 text-xs font-medium text-terracotta">Updating quantity...</p>
                        ) : qtySuccessVisibleById[String(item.id)] ? (
                          <p className="mt-1 text-xs font-medium text-sage">Updated</p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-1">
                          {qtyLoadingVisibleById[String(item.id)] ? (
                            <span
                              className="mr-1 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-terracotta"
                              aria-label="Updating quantity"
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => updateQuantity(String(item.id), item.quantity - 1)}
                            disabled={Boolean(qtyActionPendingById[String(item.id)])}
                            className="flex h-7 w-7 items-center justify-center rounded border border-amber-200 text-umber hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={item.quantity === 1 ? "Remove item" : "Decrease"}
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(String(item.id), item.quantity + 1)}
                            disabled={
                              Boolean(qtyActionPendingById[String(item.id)]) ||
                              (getStockLimit(item) !== undefined && item.quantity >= (getStockLimit(item) ?? 0))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded border border-amber-200 text-umber hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Increase"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(String(item.id))}
                            disabled={Boolean(qtyActionPendingById[String(item.id)])}
                            className="ml-2 text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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

