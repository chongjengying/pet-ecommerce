import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { resolveSessionUser } from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";
import { addOrIncrementCartItem, getCartView } from "@/lib/cartDb";

type CartBody = {
  productId?: unknown;
  product_id?: unknown;
  quantity?: unknown;
};

export async function POST(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cart API is not configured." },
      { status: 503 }
    );
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

  let body: CartBody;
  try {
    body = (await request.json()) as CartBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const productId = String(body.productId ?? body.product_id ?? "").trim();
  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }

  const quantity = Math.max(1, Math.floor(Number(body.quantity ?? 1)));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number." }, { status: 400 });
  }

  const addError = await addOrIncrementCartItem(supabase, userIdKey, productId, quantity);
  if (addError) {
    return NextResponse.json({ error: addError.message || "Could not add to cart." }, { status: 400 });
  }

  const refreshed = await getCartView(supabase, userIdKey);
  if (refreshed.error || !refreshed.data) {
    return NextResponse.json({ error: refreshed.error?.message || "Could not reload cart." }, { status: 400 });
  }
  return NextResponse.json(refreshed.data);
}

