"use client";

import Image from "next/image";
import { resolveProductImageUrl } from "@/lib/productImage";

export type CartRowItem = {
  id: string;
  product_id: string;
  quantity: number;
  price_at_time: number;
  line_total: number;
  product: {
    id: string;
    name: string;
    image: string | null;
    image_url: string | null;
    stock: number | null;
  };
};

type CartItemRowProps = {
  item: CartRowItem;
  busy?: boolean;
  onDecrease: (itemId: string) => void;
  onIncrease: (itemId: string) => void;
  onRemove: (itemId: string) => void;
};

function toProductForImage(item: CartRowItem) {
  return {
    id: item.product.id,
    name: item.product.name,
    image: item.product.image ?? undefined,
    image_url: item.product.image_url ?? undefined,
    price: item.price_at_time,
  };
}

export default function CartItemRow({ item, busy = false, onDecrease, onIncrease, onRemove }: CartItemRowProps) {
  const imageUrl = resolveProductImageUrl(toProductForImage(item));
  const outOfStock = item.product.stock != null && item.product.stock <= 0;
  const cannotIncrease = outOfStock || (item.product.stock != null && item.quantity >= item.product.stock);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100 sm:h-28 sm:w-28">
        <Image src={imageUrl} alt={item.product.name} fill unoptimized className="object-cover" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-base font-semibold text-zinc-900">{item.product.name}</h3>
        <p className="mt-1 text-sm text-zinc-600">RM{item.price_at_time.toFixed(2)} each</p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDecrease(item.id)}
            disabled={busy}
            aria-label={item.quantity === 1 ? "Keep minimum quantity" : "Decrease quantity"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            -
          </button>
          <span className="w-8 text-center text-sm font-medium text-zinc-900">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onIncrease(item.id)}
            disabled={busy || cannotIncrease}
            aria-label="Increase quantity"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={busy}
            className="ml-2 text-sm font-medium text-red-600 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="text-right text-lg font-semibold text-zinc-900 sm:min-w-[120px]">
        RM{item.line_total.toFixed(2)}
      </div>
    </article>
  );
}
