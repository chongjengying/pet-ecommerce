"use client";

import Image from "next/image";
import { resolveProductImageUrl } from "@/lib/productImage";

export type CartRowItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  price_at_time: number | null;
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
  badge?: string;
  subtitle?: string;
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
    price: item.unit_price,
  };
}

export default function CartItemRow({
  item,
  busy = false,
  badge,
  subtitle,
  onDecrease,
  onIncrease,
  onRemove,
}: CartItemRowProps) {
  const imageUrl = resolveProductImageUrl(toProductForImage(item));
  const outOfStock = item.product.stock != null && item.product.stock <= 0;
  const cannotIncrease = outOfStock || (item.product.stock != null && item.quantity >= item.product.stock);

  return (
    <article className="rounded-[20px] border border-amber-200/60 bg-white/90 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-3xl sm:p-7">
      <div className="flex items-center gap-4 sm:gap-7">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-amber-50 ring-1 ring-black/[0.04] sm:h-28 sm:w-28 sm:rounded-3xl">
          <Image src={imageUrl} alt={item.product.name} fill unoptimized className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {badge ? (
                <span className="inline-flex rounded-full bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-umber ring-1 ring-black/[0.05]">
                  {badge}
                </span>
              ) : null}
              <h3 className="mt-1 line-clamp-2 text-base font-semibold tracking-tight text-umber sm:mt-2 sm:text-xl">
                {item.product.name}
              </h3>
              <p className="mt-1 text-xs text-umber/55 sm:text-sm">
                {subtitle ? subtitle : `RM${item.unit_price.toFixed(2)} each`}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-terracotta sm:text-base">
                RM{item.line_total.toFixed(2)}
              </p>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                disabled={busy}
                className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-umber/55 transition hover:text-umber disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current opacity-70">
                  <path d="M9 3h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2h-1l-1.2 13.2A2 2 0 0 1 14.81 22H9.19a2 2 0 0 1-1.99-1.8L6 7H5a1 1 0 1 1 0-2h4V4a1 1 0 0 1 1-1Zm2 2v0h2V5h-2ZM8.02 7l1.16 12.76c.02.14.14.24.28.24h5.08c.14 0 .26-.1.28-.24L16 7H8.02Z" />
                </svg>
                Remove
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 sm:mt-5">
            <div className="inline-flex items-center rounded-full bg-cream px-2 py-1.5 ring-1 ring-black/[0.06] sm:px-3 sm:py-2">
              <button
                type="button"
                onClick={() => onDecrease(item.id)}
                disabled={busy}
                aria-label={item.quantity === 1 ? "Keep minimum quantity" : "Decrease quantity"}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-umber/80 transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9"
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-semibold text-umber">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onIncrease(item.id)}
                disabled={busy || cannotIncrease}
                aria-label="Increase quantity"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-umber/80 transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9"
              >
                +
              </button>
            </div>

            {outOfStock ? (
              <span className="text-xs font-semibold text-red-600">Out of stock</span>
            ) : cannotIncrease ? (
              <span className="text-xs font-semibold text-umber/55">Max stock reached</span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
