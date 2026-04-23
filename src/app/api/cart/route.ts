import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { resolveSessionUser } from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";
import {
  addOrIncrementCartItem,
  getCartItemByProductId,
  getCartView,
  removeCartItemById,
  setCartItemQuantityById,
} from "@/lib/cartDb";

type CartPatchBody = {
  itemId?: unknown;
  item_id?: unknown;
  productId?: unknown;
  product_id?: unknown;
  user_id?: unknown;
  action?: unknown;
  quantity?: unknown;
};

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (process.env.NODE_ENV !== "production") {
    console.log("[api/cart][GET] start");
  }
  const session = await getCustomerFromRequest(request);
  if (!session) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/cart][GET] unauthorized", { elapsedMs: Date.now() - startedAt });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/cart][GET] supabase unavailable", { elapsedMs: Date.now() - startedAt });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cart API is not configured." }, { status: 503 });
  }

  const resolved = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolved) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/cart][GET] profile not found", { elapsedMs: Date.now() - startedAt });
    }
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const userIdKey = userIdForDbQuery(resolved.id);
  const result = await getCartView(supabase, userIdKey);
  if (result.error || !result.data) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/cart][GET] failed", {
        elapsedMs: Date.now() - startedAt,
        error: result.error?.message ?? "Could not load cart.",
      });
    }
    return NextResponse.json({ error: result.error?.message || "Could not load cart." }, { status: 400 });
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[api/cart][GET] success", {
      elapsedMs: Date.now() - startedAt,
      itemCount: result.data.item_count,
      subtotal: result.data.subtotal,
    });
  }
  return NextResponse.json(result.data);
}

export async function PATCH(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cart API is not configured." }, { status: 503 });
  }

  const resolved = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolved) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  const userIdKey = userIdForDbQuery(resolved.id);

  let body: CartPatchBody;
  try {
    body = (await request.json()) as CartPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  let itemId = String(body.itemId ?? body.item_id ?? "").trim();
  const productId = String(body.productId ?? body.product_id ?? "").trim();
  if (!itemId && !productId) return NextResponse.json({ error: "itemId or productId is required." }, { status: 400 });

  const nextQty = Math.max(0, Math.floor(Number(body.quantity ?? 1)));
  if (!Number.isFinite(nextQty)) {
    return NextResponse.json({ error: "quantity must be a valid number." }, { status: 400 });
  }

  if (!itemId) {
    const lookup = await getCartItemByProductId(supabase, userIdKey, productId);
    if (lookup.error) {
      return NextResponse.json({ error: lookup.error.message || "Could not load cart item." }, { status: 400 });
    }
    if (!lookup.itemId) return NextResponse.json({ error: "Cart item not found." }, { status: 404 });
    itemId = lookup.itemId;
  }

  if (nextQty <= 0) {
    const removeError = await removeCartItemById(supabase, userIdKey, itemId);
    if (removeError) {
      return NextResponse.json({ error: removeError.message || "Could not remove cart item." }, { status: 400 });
    }
  } else {
    const updateError = await setCartItemQuantityById(supabase, userIdKey, itemId, nextQty);
    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Could not update cart item." }, { status: 400 });
    }
  }

  const refreshed = await getCartView(supabase, userIdKey);
  if (refreshed.error || !refreshed.data) {
    return NextResponse.json({ error: refreshed.error?.message || "Could not reload cart." }, { status: 400 });
  }
  return NextResponse.json(refreshed.data);
}

export async function DELETE(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cart API is not configured." }, { status: 503 });
  }

  const resolved = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolved) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  const userIdKey = userIdForDbQuery(resolved.id);

  const url = new URL(request.url);
  let itemId = String(url.searchParams.get("itemId") ?? "").trim();
  const productId = String(url.searchParams.get("productId") ?? "").trim();
  if (!itemId && !productId) return NextResponse.json({ error: "itemId or productId is required." }, { status: 400 });

  if (!itemId && productId) {
    const lookup = await getCartItemByProductId(supabase, userIdKey, productId);
    if (lookup.error) {
      return NextResponse.json({ error: lookup.error.message || "Could not load cart item." }, { status: 400 });
    }
    if (!lookup.itemId) return NextResponse.json({ error: "Cart item not found." }, { status: 404 });
    itemId = lookup.itemId;
  }

  const removeError = await removeCartItemById(supabase, userIdKey, itemId);
  if (removeError) {
    return NextResponse.json({ error: removeError.message || "Could not remove cart item." }, { status: 400 });
  }

  const refreshed = await getCartView(supabase, userIdKey);
  if (refreshed.error || !refreshed.data) {
    return NextResponse.json({ error: refreshed.error?.message || "Could not reload cart." }, { status: 400 });
  }
  return NextResponse.json(refreshed.data);
}

export async function POST(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cart API is not configured." }, { status: 503 });
  }

  const resolved = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolved) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  const userIdKey = userIdForDbQuery(resolved.id);
  const url = new URL(request.url);
  const includeFullView = url.searchParams.get("include") === "full";

  let body: CartPatchBody = {};
  try {
    body = (await request.json()) as CartPatchBody;
  } catch {
    if (includeFullView) {
      const refreshed = await getCartView(supabase, userIdKey);
      if (refreshed.error || !refreshed.data) {
        return NextResponse.json({ error: refreshed.error?.message || "Could not reload cart." }, { status: 400 });
      }
      return NextResponse.json(refreshed.data);
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const productId = String(body.productId ?? body.product_id ?? "").trim();
  if (!productId) {
    if (includeFullView) {
      const refreshed = await getCartView(supabase, userIdKey);
      if (refreshed.error || !refreshed.data) {
        return NextResponse.json({ error: refreshed.error?.message || "Could not reload cart." }, { status: 400 });
      }
      return NextResponse.json(refreshed.data);
    }
    console.error("[api/cart POST] Missing product id in body", body);
    return NextResponse.json({ error: "productId (or product_id) is required.", code: "MISSING_PRODUCT_ID" }, { status: 400 });
  }
  const quantity = Math.max(1, Math.floor(Number(body.quantity ?? 1)));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    console.error("[api/cart POST] Invalid quantity", { body, quantity });
    return NextResponse.json({ error: "quantity must be a positive number.", code: "INVALID_QUANTITY" }, { status: 400 });
  }

  const addError = await addOrIncrementCartItem(supabase, userIdKey, productId, quantity);
  if (addError) {
    console.error("[api/cart POST] addOrIncrementCartItem failed", {
      user_id: String(userIdKey),
      product_id: productId,
      quantity,
      error: addError,
    });
    return NextResponse.json(
      {
        error: addError.message || "Could not add to cart.",
        code: "ADD_TO_CART_FAILED",
        details: { user_id: String(userIdKey), product_id: productId, quantity },
      },
      { status: 400 }
    );
  }

  if (!includeFullView) {
    return NextResponse.json({
      ok: true,
      product_id: productId,
      quantity_added: quantity,
    });
  }

  const refreshed = await getCartView(supabase, userIdKey);
  if (refreshed.error || !refreshed.data) {
    return NextResponse.json({ error: refreshed.error?.message || "Could not reload cart." }, { status: 400 });
  }
  return NextResponse.json(refreshed.data);
}
