import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { resolveSessionUser } from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";
import {
  getOrCreateCartId,
  removeCartItemById,
} from "@/lib/cartDb";

type PatchBody = {
  quantity?: unknown;
};

type LightweightCartTotals = {
  item_count: number;
  subtotal: number;
};

async function getLightweightTotals(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  cartId: string
): Promise<{ totals: LightweightCartTotals | null; error: string | null }> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("quantity,unit_price,price_at_time")
    .eq("cart_id", cartId);

  if (error) {
    return { totals: null, error: error.message || "Could not load cart totals." };
  }

  const rows = Array.isArray(data) ? data : [];
  const item_count = rows.reduce((sum, row) => {
    const qty = Math.max(0, Math.floor(Number((row as { quantity?: unknown }).quantity ?? 0)));
    return sum + qty;
  }, 0);
  const subtotal = rows.reduce((sum, row) => {
    const qty = Math.max(0, Math.floor(Number((row as { quantity?: unknown }).quantity ?? 0)));
    const unitPrice = Number(
      (row as { unit_price?: unknown; price_at_time?: unknown }).unit_price ??
      (row as { unit_price?: unknown; price_at_time?: unknown }).price_at_time ??
      0
    );
    return sum + qty * (Number.isFinite(unitPrice) ? unitPrice : 0);
  }, 0);

  return { totals: { item_count, subtotal }, error: null };
}

async function resolveAuthedUser(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse };

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return {
      error: NextResponse.json(
        { error: err instanceof Error ? err.message : "Cart API is not configured." },
        { status: 503 }
      ) as NextResponse,
    };
  }

  const resolved = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolved) return { error: NextResponse.json({ error: "Profile not found." }, { status: 404 }) as NextResponse };

  return { supabase, userIdKey: userIdForDbQuery(resolved.id) };
}

async function resolveItemIdFromPathId(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  cartId: string,
  id: string
): Promise<{ itemId: string | null; error: string | null }> {
  const idKey = /^[0-9]+$/.test(id) ? Number(id) : id;
  const selectAttempts = [
    "id,product_id",
    "cart_item_id,product_id",
  ] as const;

  for (const select of selectAttempts) {
    const hasId = select.startsWith("id,");
    const itemPk = hasId ? "id" : "cart_item_id";

    const byItem = await supabase
      .from("cart_items")
      .select(select)
      .eq("cart_id", cartId)
      .eq(itemPk, idKey)
      .maybeSingle();
    if (!byItem.error && byItem.data) {
      const row = byItem.data as { id?: unknown; cart_item_id?: unknown };
      return { itemId: String((hasId ? row.id : row.cart_item_id) ?? ""), error: null };
    }

    const byProduct = await supabase
      .from("cart_items")
      .select(select)
      .eq("cart_id", cartId)
      .eq("product_id", idKey)
      .order(itemPk, { ascending: true })
      .limit(1);
    if (!byProduct.error && Array.isArray(byProduct.data) && byProduct.data.length > 0) {
      const row = byProduct.data[0] as { id?: unknown; cart_item_id?: unknown };
      return { itemId: String((hasId ? row.id : row.cart_item_id) ?? ""), error: null };
    }
  }

  return { itemId: null, error: "Cart item not found." };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authed = await resolveAuthedUser(request);
  if ("error" in authed) return authed.error;
  const { supabase, userIdKey } = authed;

  const { id: rawId } = await context.params;
  const id = String(rawId ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing cart item id." }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const qty = Math.floor(Number(body.quantity));
  if (!Number.isFinite(qty) || qty < 1) {
    return NextResponse.json({ error: "quantity must be a number >= 1." }, { status: 400 });
  }

  // 1) Verify current user owns this cart item (or can resolve it from product id in path).
  const cartResult = await getOrCreateCartId(supabase, userIdKey);
  if (cartResult.error || !cartResult.cartId) {
    return NextResponse.json({ error: cartResult.error?.message || "Could not resolve cart." }, { status: 400 });
  }

  const resolvedItem = await resolveItemIdFromPathId(supabase, cartResult.cartId, id);
  if (resolvedItem.error || !resolvedItem.itemId) {
    return NextResponse.json({ error: resolvedItem.error ?? "Cart item not found." }, { status: 404 });
  }

  // 2) Update final quantity.
  const itemIdKey = /^[0-9]+$/.test(resolvedItem.itemId) ? Number(resolvedItem.itemId) : resolvedItem.itemId;
  const updateById = await supabase
    .from("cart_items")
    .update({ quantity: qty })
    .eq("cart_id", cartResult.cartId)
    .eq("id", itemIdKey)
    .select("id,quantity")
    .maybeSingle();

  let itemRow = updateById.data;
  if (!itemRow) {
    const updateByCartItemId = await supabase
      .from("cart_items")
      .update({ quantity: qty })
      .eq("cart_id", cartResult.cartId)
      .eq("cart_item_id", itemIdKey)
      .select("cart_item_id,quantity")
      .maybeSingle();
    if (updateByCartItemId.error || !updateByCartItemId.data) {
      return NextResponse.json(
        { error: updateByCartItemId.error?.message || updateById.error?.message || "Could not update cart item." },
        { status: 400 }
      );
    }
    itemRow = updateByCartItemId.data as { id?: unknown; cart_item_id?: unknown; quantity?: unknown };
  }

  // 3) Return minimal payload.
  const { totals, error: totalsError } = await getLightweightTotals(supabase, cartResult.cartId);
  if (totalsError || !totals) {
    return NextResponse.json({ error: totalsError || "Could not load cart totals." }, { status: 400 });
  }

  const updatedId = String(
    (itemRow as { id?: unknown; cart_item_id?: unknown })?.id ??
    (itemRow as { id?: unknown; cart_item_id?: unknown })?.cart_item_id ??
    resolvedItem.itemId
  );
  return NextResponse.json({
    item: {
      id: /^[0-9]+$/.test(updatedId) ? Number(updatedId) : updatedId,
      quantity: Math.max(1, Math.floor(Number((itemRow as { quantity?: unknown })?.quantity ?? qty))),
    },
    totals: {
      subtotal: Number(totals.subtotal.toFixed(2)),
      grand_total: Number(totals.subtotal.toFixed(2)),
    },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authed = await resolveAuthedUser(request);
  if ("error" in authed) return authed.error;
  const { supabase, userIdKey } = authed;

  const { id: rawId } = await context.params;
  const id = String(rawId ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing cart item id." }, { status: 400 });

  const cartResult = await getOrCreateCartId(supabase, userIdKey);
  if (cartResult.error || !cartResult.cartId) {
    return NextResponse.json({ error: cartResult.error?.message || "Could not resolve cart." }, { status: 400 });
  }

  const resolvedItem = await resolveItemIdFromPathId(supabase, cartResult.cartId, id);
  if (resolvedItem.error || !resolvedItem.itemId) {
    return NextResponse.json({ error: resolvedItem.error ?? "Cart item not found." }, { status: 404 });
  }

  const removeError = await removeCartItemById(supabase, userIdKey, resolvedItem.itemId);
  if (removeError) {
    return NextResponse.json({ error: removeError.message || "Could not remove cart item." }, { status: 400 });
  }

  const { totals, error: totalsError } = await getLightweightTotals(supabase, cartResult.cartId);
  if (totalsError || !totals) {
    return NextResponse.json({ error: totalsError || "Could not load cart totals." }, { status: 400 });
  }
  return NextResponse.json({
    removed_item_id: resolvedItem.itemId,
    totals,
  });
}
