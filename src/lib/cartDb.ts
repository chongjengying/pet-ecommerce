import { getSupabaseServerClient } from "@/lib/supabaseServer";

type Supabase = ReturnType<typeof getSupabaseServerClient>;
type DbError = { message?: string } | null;

type CartRow = {
  id?: string | number;
  cart_id?: string | number;
  user_id?: string | number;
  [key: string]: unknown;
};

type CartItemRow = {
  id?: string | number;
  cart_item_id?: string | number;
  cart_id?: string | number;
  user_id?: string | number;
  product_id?: string | number;
  quantity?: number;
  unit_price?: number | string | null;
  price_at_time?: number | string | null;
  [key: string]: unknown;
};

type ProductRow = {
  id?: string | number;
  product_id?: string | number;
  name?: string | null;
  image?: string | null;
  image_url?: string | null;
  price?: number | string | null;
  stock?: number | string | null;
  [key: string]: unknown;
};

type ProductSnapshot = {
  id: string;
  stock: number | null;
  unitPrice: number;
  statusRaw: unknown;
  name: string | null;
  sku: string | null;
};

export type CartItemView = {
  id: string;
  cart_id: string;
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

export type CartView = {
  cart_id: string;
  item_count: number;
  subtotal: number;
  items: CartItemView[];
};

function normalizeId(value: unknown): string {
  return String(value ?? "");
}

function normalizeDbKey(value: unknown): string | number {
  const s = String(value ?? "").trim();
  if (/^[0-9]+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return s;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "active", "enabled", "published"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive", "disabled", "draft", "archived"].includes(normalized)) return false;
  }
  return undefined;
}

function isProductVisible(row: ProductRow | undefined): boolean {
  if (!row) return false;
  const status = toOptionalBoolean(row.status);
  if (status !== undefined) return status;
  return true;
}

async function getProductSnapshotById(
  supabase: Supabase,
  productId: string | number
): Promise<{ product: ProductSnapshot | null; error: DbError }> {
  const productPk = await getProductPkColumn(supabase);
  const productIdKey = normalizeDbKey(productId);
  const selectAttempts = [
    `${productPk},price,stock,status,name,sku`,
    `${productPk},price,stock,status,name,product_sku`,
    `${productPk},price,stock,status,name`,
    `${productPk},price,stock,status`,
  ] as const;

  for (const select of selectAttempts) {
    const { data, error } = await supabase
      .from("products")
      .select(select)
      .eq(productPk, productIdKey)
      .maybeSingle();
    if (error) {
      if (
        isMissingColumn(error, "sku") ||
        isMissingColumn(error, "product_sku") ||
        isMissingColumn(error, "name")
      ) {
        continue;
      }
      return { product: null, error };
    }

    const row = (data as unknown as ProductRow) ?? null;
    if (!row) return { product: null, error: null };
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) {
      return { product: null, error: { message: "Product price is invalid." } };
    }
    const stock = row.stock == null ? null : normalizeNumber(row.stock, 0);
    const statusRaw = (row as Record<string, unknown>).status;
    const skuRaw = (row as Record<string, unknown>).sku ?? (row as Record<string, unknown>).product_sku;

    return {
      product: {
        id: normalizeId(row[productPk]),
        stock,
        unitPrice: price,
        statusRaw,
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : null,
        sku: typeof skuRaw === "string" && skuRaw.trim() ? skuRaw.trim() : null,
      },
      error: null,
    };
  }

  return { product: null, error: { message: "Product snapshot could not be resolved." } };
}

function isMissingColumn(error: unknown, column: string): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    message.includes(column.toLowerCase()) &&
    message.includes("column") &&
    (message.includes("does not exist") || message.includes("could not find"))
  );
}

function isMissingRelation(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("table") && message.includes("does not exist"))
  );
}

function isMultipleRowsError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    message.includes("multiple rows") ||
    message.includes("json object requested") ||
    message.includes("more than one row")
  );
}

const columnCache = new Map<string, string>();
const tableCache = new Map<string, string>();
const hasColumnCache = new Map<string, boolean>();

async function hasColumn(supabase: Supabase, table: string, column: string): Promise<boolean> {
  const key = `${table}:${column}`;
  const cached = hasColumnCache.get(key);
  if (cached !== undefined) return cached;

  const probe = await supabase.from(table).select(column).limit(1);
  if (!probe.error) {
    hasColumnCache.set(key, true);
    return true;
  }
  if (isMissingColumn(probe.error, column)) {
    hasColumnCache.set(key, false);
    return false;
  }
  // Permission/schema cache errors: assume it exists so we don't accidentally drop data paths.
  hasColumnCache.set(key, true);
  return true;
}

function getCartAbandonAfterMs(): number {
  const raw = Number(process.env.CART_ABANDON_AFTER_HOURS ?? 24);
  const hours = Number.isFinite(raw) && raw > 0 ? raw : 24;
  return hours * 60 * 60 * 1000;
}

async function markStaleActiveCartsAbandoned(
  supabase: Supabase,
  userIdKey: string | number
): Promise<DbError> {
  const abandonBeforeIso = new Date(Date.now() - getCartAbandonAfterMs()).toISOString();
  const { error } = await supabase
    .from("cart")
    .update({ status: "abandoned" })
    .eq("user_id", userIdKey)
    .eq("status", "active")
    .lt("created_at", abandonBeforeIso);

  if (!error) return null;
  if (isMissingColumn(error, "status") || isMissingColumn(error, "created_at")) return null;
  return error;
}

async function reviveLatestAbandonedCart(
  supabase: Supabase,
  userIdKey: string | number
): Promise<{ cart: CartRow | null; error: DbError }> {
  const cartPk = await getCartPkColumn(supabase);
  const abandoned = await supabase
    .from("cart")
    .select(`${cartPk},user_id,status,created_at`)
    .eq("user_id", userIdKey)
    .eq("status", "abandoned")
    .order("created_at", { ascending: false })
    .limit(1);

  if (abandoned.error) {
    if (isMissingColumn(abandoned.error, "status")) {
      return { cart: null, error: null };
    }
    return { cart: null, error: abandoned.error };
  }

  const row =
    Array.isArray(abandoned.data) && abandoned.data.length > 0
      ? (abandoned.data[0] as unknown as CartRow)
      : null;
  if (!row) return { cart: null, error: null };

  const cartId = normalizeDbKey(row[cartPk]);
  const { data: revived, error: reviveError } = await supabase
    .from("cart")
    .update({ status: "active" })
    .eq(cartPk, cartId)
    .eq("user_id", userIdKey)
    .select(`${cartPk},user_id,status,created_at`)
    .maybeSingle();
  if (reviveError) return { cart: null, error: reviveError };

  return { cart: (revived as unknown as CartRow) ?? row, error: null };
}

async function resolveColumn(
  supabase: Supabase,
  table: string,
  candidates: string[]
): Promise<string> {
  const cacheKey = `${table}:${candidates.join("|")}`;
  const cached = columnCache.get(cacheKey);
  if (cached) return cached;

  for (const candidate of candidates) {
    const probe = await supabase.from(table).select(candidate).limit(1);
    if (!probe.error) {
      columnCache.set(cacheKey, candidate);
      return candidate;
    }
    if (!isMissingColumn(probe.error, candidate)) {
      // If the error is not about a missing column, still try next fallback.
      continue;
    }
  }

  const fallback = candidates[0];
  columnCache.set(cacheKey, fallback);
  return fallback;
}

async function getCartPkColumn(supabase: Supabase): Promise<string> {
  return resolveColumn(supabase, "cart", ["id", "cart_id"]);
}

async function getCartItemPkColumn(supabase: Supabase): Promise<string> {
  return resolveColumn(supabase, "cart_items", ["id", "cart_item_id"]);
}

async function getProductPkColumn(supabase: Supabase): Promise<string> {
  return resolveColumn(supabase, "products", ["product_id", "id"]);
}

async function resolveTable(
  supabase: Supabase,
  cacheKey: string,
  candidates: string[]
): Promise<string | null> {
  const cached = tableCache.get(cacheKey);
  if (cached) return cached;

  for (const table of candidates) {
    const probe = await supabase.from(table).select("*").limit(1);
    if (!probe.error) {
      tableCache.set(cacheKey, table);
      return table;
    }
    if (isMissingRelation(probe.error)) continue;
  }

  return null;
}

async function getProductImageMap(
  supabase: Supabase,
  productIdKeys: Array<string | number>
): Promise<{ map: Map<string, string>; error: DbError }> {
  const imageTable = await resolveTable(supabase, "product-image-table", ["product_images", "product_image"]);
  if (!imageTable) {
    return { map: new Map<string, string>(), error: null };
  }

  const imageProductPk = await resolveColumn(supabase, imageTable, ["product_id"]);
  const imageUrlColumn = await resolveColumn(supabase, imageTable, ["image_url", "url", "image"]);

  let imageQuery = await supabase
    .from(imageTable)
    .select(`${imageProductPk},${imageUrlColumn},is_main,sort_order,created_at`)
    .in(imageProductPk, productIdKeys)
    .order("is_main", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (
    imageQuery.error &&
    (isMissingColumn(imageQuery.error, "is_main") ||
      isMissingColumn(imageQuery.error, "sort_order") ||
      isMissingColumn(imageQuery.error, "created_at"))
  ) {
    imageQuery = (await supabase
      .from(imageTable)
      .select(`${imageProductPk},${imageUrlColumn}`)
      .in(imageProductPk, productIdKeys)) as typeof imageQuery;
  }

  if (imageQuery.error) return { map: new Map<string, string>(), error: imageQuery.error };

  const imageMap = new Map<string, string>();
  const imageRows = (Array.isArray(imageQuery.data) ? imageQuery.data : []) as unknown as Array<Record<string, unknown>>;
  for (const row of imageRows) {
    const pid = normalizeId(row[imageProductPk]);
    const url = String(row[imageUrlColumn] ?? "").trim();
    if (!pid || !url || imageMap.has(pid)) continue;
    imageMap.set(pid, url);
  }

  return { map: imageMap, error: null };
}

async function insertCartItem(
  supabase: Supabase,
  payload: {
    cart_id: string;
    user_id: string | number;
    product_id: string | number;
    quantity: number;
    unit_price: number;
    price_at_time?: number | null;
    product_name?: string | null;
    sku?: string | null;
  }
): Promise<DbError> {
  const insertPayload: Record<string, unknown> = { ...payload };
  if (!(await hasColumn(supabase, "cart_items", "unit_price"))) {
    delete insertPayload.unit_price;
  }
  if (!(await hasColumn(supabase, "cart_items", "price_at_time"))) {
    delete insertPayload.price_at_time;
  }
  if (!(await hasColumn(supabase, "cart_items", "product_name"))) {
    delete insertPayload.product_name;
  }
  if (!(await hasColumn(supabase, "cart_items", "sku"))) {
    delete insertPayload.sku;
  }

  const withUserId = await supabase.from("cart_items").insert(insertPayload);
  if (!withUserId.error) return null;
  if (!isMissingColumn(withUserId.error, "user_id")) return withUserId.error;

  const fallbackPayload = {
    cart_id: insertPayload.cart_id,
    product_id: insertPayload.product_id,
    quantity: insertPayload.quantity,
    unit_price: insertPayload.unit_price,
    price_at_time: insertPayload.price_at_time,
    product_name: insertPayload.product_name,
    sku: insertPayload.sku,
  };
  const withoutUserId = await supabase.from("cart_items").insert(fallbackPayload);
  return withoutUserId.error;
}

async function selectActiveCart(supabase: Supabase, userIdKey: string | number): Promise<{ cart: CartRow | null; error: DbError }> {
  const cartPk = await getCartPkColumn(supabase);
  const withStatus = await supabase
    .from("cart")
    .select(`${cartPk},user_id,status,created_at`)
    .eq("user_id", userIdKey)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  if (!withStatus.error) {
    const row = Array.isArray(withStatus.data) && withStatus.data.length > 0 ? (withStatus.data[0] as unknown as CartRow) : null;
    return { cart: row, error: null };
  }
  if (!isMissingColumn(withStatus.error, "status")) {
    return { cart: null, error: withStatus.error };
  }

  const noStatus = await supabase
    .from("cart")
    .select(`${cartPk},user_id,created_at`)
    .eq("user_id", userIdKey)
    .order("created_at", { ascending: false })
    .limit(1);
  if (noStatus.error) return { cart: null, error: noStatus.error };
  const row = Array.isArray(noStatus.data) && noStatus.data.length > 0 ? (noStatus.data[0] as unknown as CartRow) : null;
  return { cart: row, error: null };
}

async function createCart(supabase: Supabase, userIdKey: string | number): Promise<{ cart: CartRow | null; error: DbError }> {
  const cartPk = await getCartPkColumn(supabase);
  const payload: Record<string, unknown> = { user_id: userIdKey, status: "active" };
  const withStatus = await supabase.from("cart").insert(payload).select(`${cartPk},user_id`).single();
  if (!withStatus.error && withStatus.data) return { cart: withStatus.data as unknown as CartRow, error: null };
  if (!withStatus.error) return { cart: null, error: null };
  if (!isMissingColumn(withStatus.error, "status")) return { cart: null, error: withStatus.error };

  delete payload.status;
  const noStatus = await supabase.from("cart").insert(payload).select(`${cartPk},user_id`).single();
  if (noStatus.error) return { cart: null, error: noStatus.error };
  return { cart: noStatus.data as unknown as CartRow, error: null };
}

async function linkOrphanCartItemsToCart(
  supabase: Supabase,
  userIdKey: string | number,
  cartId: string
): Promise<DbError> {
  const cartIdKey = normalizeDbKey(cartId);
  const hasUserId = await hasColumn(supabase, "cart_items", "user_id");
  if (!hasUserId) return null;

  const { error } = await supabase
    .from("cart_items")
    .update({ cart_id: cartIdKey })
    .eq("user_id", userIdKey)
    .is("cart_id", null);

  if (!error) return null;
  if (isMissingColumn(error, "cart_id") || isMissingColumn(error, "user_id")) return null;
  return error;
}

export async function getOrCreateCartId(supabase: Supabase, userIdKey: string | number): Promise<{ cartId: string | null; error: DbError }> {
  const cartPk = await getCartPkColumn(supabase);
  const abandonError = await markStaleActiveCartsAbandoned(supabase, userIdKey);
  if (abandonError) return { cartId: null, error: abandonError };

  const existing = await selectActiveCart(supabase, userIdKey);
  if (existing.error) return { cartId: null, error: existing.error };
  const existingCartId = existing.cart ? existing.cart[cartPk] : null;
  if (existingCartId != null) {
    const cartId = normalizeId(existingCartId);
    const linkError = await linkOrphanCartItemsToCart(supabase, userIdKey, cartId);
    if (linkError) return { cartId: null, error: linkError };
    return { cartId, error: null };
  }

  const revived = await reviveLatestAbandonedCart(supabase, userIdKey);
  if (revived.error) return { cartId: null, error: revived.error };
  const revivedCartId = revived.cart ? revived.cart[cartPk] : null;
  if (revivedCartId != null) {
    const cartId = normalizeId(revivedCartId);
    const linkError = await linkOrphanCartItemsToCart(supabase, userIdKey, cartId);
    if (linkError) return { cartId: null, error: linkError };
    return { cartId, error: null };
  }

  const created = await createCart(supabase, userIdKey);
  if (created.error) return { cartId: null, error: created.error };
  const createdCartId = created.cart ? created.cart[cartPk] : null;
  const cartId = createdCartId != null ? normalizeId(createdCartId) : null;
  if (!cartId) return { cartId: null, error: null };
  const linkError = await linkOrphanCartItemsToCart(supabase, userIdKey, cartId);
  if (linkError) return { cartId: null, error: linkError };
  return { cartId, error: null };
}

export async function getCartView(supabase: Supabase, userIdKey: string | number): Promise<{ data: CartView | null; error: DbError }> {
  const itemPk = await getCartItemPkColumn(supabase);
  const productPk = await getProductPkColumn(supabase);
  const cartResult = await getOrCreateCartId(supabase, userIdKey);
  if (cartResult.error || !cartResult.cartId) {
    return { data: null, error: cartResult.error ?? { message: "Could not resolve cart." } };
  }

  const cartId = cartResult.cartId;
  const itemSelectAttempts = [
    `${itemPk},cart_id,product_id,quantity,unit_price,price_at_time`,
    `${itemPk},cart_id,product_id,quantity,unit_price`,
    `${itemPk},cart_id,product_id,quantity,price_at_time`,
  ] as const;
  let itemData: unknown = [];
  let itemError: DbError = null;
  for (const select of itemSelectAttempts) {
    const response = await supabase
      .from("cart_items")
      .select(select)
      .eq("cart_id", cartId)
      .order(itemPk, { ascending: true });
    if (!response.error) {
      itemData = response.data;
      itemError = null;
      break;
    }
    const missingUnitPrice = isMissingColumn(response.error, "unit_price");
    const missingPriceAtTime = isMissingColumn(response.error, "price_at_time");
    if (!missingUnitPrice && !missingPriceAtTime) {
      itemError = response.error;
      break;
    }
    itemError = response.error;
  }
  if (itemError) return { data: null, error: itemError };

  const items = (Array.isArray(itemData) ? itemData : []) as unknown as CartItemRow[];
  const productIds = items.map((row) => normalizeId(row.product_id)).filter((id) => id.length > 0);

  let productMap = new Map<string, ProductRow>();
  let productImageMap = new Map<string, string>();
  if (productIds.length > 0) {
    const productIdKeys = Array.from(new Set(productIds.map((id) => normalizeDbKey(id))));
    const productSelectAttempts = [
      `${productPk},name,price,stock,status`,
      `${productPk},name,price,stock`,
    ] as const;
    let productsData: unknown = [];
    let productsError: DbError = null;
    for (const select of productSelectAttempts) {
      const response = await supabase
        .from("products")
        .select(select)
        .in(productPk, productIdKeys);
      if (!response.error) {
        productsData = response.data;
        productsError = null;
        break;
      }
      const missingStatus = isMissingColumn(response.error, "status");
      if (!missingStatus) {
        productsError = response.error;
        break;
      }
      productsError = response.error;
    }
    if (productsError) return { data: null, error: productsError };
    const productsRows = (Array.isArray(productsData) ? productsData : []) as unknown as ProductRow[];
    productMap = new Map(
      productsRows.map((p) => [normalizeId(p[productPk]), p])
    );

    const { map, error: productImagesError } = await getProductImageMap(supabase, productIdKeys);
    if (productImagesError) return { data: null, error: productImagesError };
    productImageMap = map;
  }

  // Auto-cleanup: remove cart items pointing to inactive/missing products.
  const hiddenItemIds = items
    .filter((row) => {
      const productId = normalizeId(row.product_id);
      const product = productMap.get(productId);
      return !isProductVisible(product);
    })
    .map((row) => normalizeDbKey(row[itemPk]))
    .filter((id) => normalizeId(id).length > 0);

  if (hiddenItemIds.length > 0) {
    const { error: cleanupError } = await supabase
      .from("cart_items")
      .delete()
      .in(itemPk, hiddenItemIds)
      .eq("cart_id", cartId);
    if (cleanupError) return { data: null, error: cleanupError };
  }

  const mappedItems: CartItemView[] = items
    .filter((row) => {
      const productId = normalizeId(row.product_id);
      const product = productMap.get(productId);
      return isProductVisible(product);
    })
    .map((row) => {
    const productId = normalizeId(row.product_id);
    const product = productMap.get(productId);
    const quantity = Math.max(1, Math.floor(normalizeNumber(row.quantity, 1)));
    const unitPrice = normalizeNumber(
      row.unit_price,
      normalizeNumber(row.price_at_time, normalizeNumber(product?.price, 0))
    );
    const priceAtTimeRaw = Number(row.price_at_time);
    const priceAtTime = Number.isFinite(priceAtTimeRaw) ? priceAtTimeRaw : null;
    const imageUrl = productImageMap.get(productId) ?? null;
    return {
      id: normalizeId(row[itemPk]),
      cart_id: normalizeId(row.cart_id),
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      price_at_time: priceAtTime,
      line_total: unitPrice * quantity,
      product: {
        id: productId,
        name: String(product?.name ?? "Product"),
        image: imageUrl,
        image_url: imageUrl,
        stock: product?.stock == null ? null : normalizeNumber(product.stock, 0),
      },
    };
  });

  const item_count = mappedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = mappedItems.reduce((sum, item) => sum + item.line_total, 0);

  return { data: { cart_id: cartId, item_count, subtotal, items: mappedItems }, error: null };
}

export async function setCartItemQuantityById(
  supabase: Supabase,
  userIdKey: string | number,
  cartItemId: string,
  quantity: number
): Promise<DbError> {
  const itemPk = await getCartItemPkColumn(supabase);
  const itemIdKey = normalizeDbKey(cartItemId);
  const qty = Math.max(1, Math.floor(Number(quantity)));
  const cartResult = await getOrCreateCartId(supabase, userIdKey);
  if (cartResult.error || !cartResult.cartId) return cartResult.error ?? { message: "Could not resolve cart." };

  const { data: existingRow, error: existingError } = await supabase
    .from("cart_items")
    .select(`${itemPk},cart_id,product_id,unit_price,price_at_time`)
    .eq(itemPk, itemIdKey)
    .eq("cart_id", cartResult.cartId)
    .maybeSingle();
  if (existingError) return existingError;
  if (!existingRow) return { message: "Cart item not found." };
  const row = existingRow as unknown as CartItemRow;

  const productId = normalizeId(row.product_id);
  if (!productId) return { message: "Cart item product is invalid." };
  const { product, error: productError } = await getProductSnapshotById(supabase, productId);
  if (productError) return productError;
  if (!product) return { message: "Product not found." };
  if (!isProductVisible({ status: product.statusRaw } as ProductRow)) {
    return { message: "Product is inactive." };
  }
  if (product.stock != null && qty > product.stock) {
    return { message: "Quantity exceeds available stock." };
  }

  const rowUnitPrice = Number(row.unit_price ?? row.price_at_time);
  const finalUnitPrice =
    Number.isFinite(rowUnitPrice) && rowUnitPrice >= 0
      ? rowUnitPrice
      : product.unitPrice;
  if (!Number.isFinite(finalUnitPrice) || finalUnitPrice < 0) {
    return { message: "Cart item unit price is invalid." };
  }

  const updatePayload: Record<string, unknown> = { quantity: qty };
  if (await hasColumn(supabase, "cart_items", "unit_price")) {
    updatePayload.unit_price = finalUnitPrice;
  }
  if (await hasColumn(supabase, "cart_items", "price_at_time")) {
    updatePayload.price_at_time = finalUnitPrice;
  }

  const { error } = await supabase
    .from("cart_items")
    .update(updatePayload)
    .eq(itemPk, itemIdKey)
    .eq("cart_id", cartResult.cartId);
  return error;
}

export async function getCartItemById(
  supabase: Supabase,
  userIdKey: string | number,
  cartItemId: string
): Promise<{ itemId: string | null; quantity: number; error: DbError }> {
  const itemPk = await getCartItemPkColumn(supabase);
  const itemIdKey = normalizeDbKey(cartItemId);
  const cartResult = await getOrCreateCartId(supabase, userIdKey);
  if (cartResult.error || !cartResult.cartId) {
    return { itemId: null, quantity: 0, error: cartResult.error ?? { message: "Could not resolve cart." } };
  }

  const { data, error } = await supabase
    .from("cart_items")
    .select(`${itemPk},quantity`)
    .eq(itemPk, itemIdKey)
    .eq("cart_id", cartResult.cartId)
    .maybeSingle();
  if (error) return { itemId: null, quantity: 0, error };
  if (!data) return { itemId: null, quantity: 0, error: null };
  const row = data as unknown as CartItemRow;

  return {
    itemId: normalizeId(row[itemPk]),
    quantity: Math.max(1, Math.floor(normalizeNumber(row.quantity, 1))),
    error: null,
  };
}

export async function getCartItemByProductId(
  supabase: Supabase,
  userIdKey: string | number,
  productId: string
): Promise<{ itemId: string | null; quantity: number; error: DbError }> {
  const itemPk = await getCartItemPkColumn(supabase);
  const productIdKey = normalizeDbKey(productId);
  const cartResult = await getOrCreateCartId(supabase, userIdKey);
  if (cartResult.error || !cartResult.cartId) {
    return { itemId: null, quantity: 0, error: cartResult.error ?? { message: "Could not resolve cart." } };
  }

  const { data, error } = await supabase
    .from("cart_items")
    .select(`${itemPk},quantity`)
    .eq("cart_id", cartResult.cartId)
    .eq("product_id", productIdKey)
    .order(itemPk, { ascending: true });
  if (error) return { itemId: null, quantity: 0, error };
  const rows = (Array.isArray(data) ? data : []) as unknown as CartItemRow[];
  if (rows.length === 0) return { itemId: null, quantity: 0, error: null };

  if (rows.length === 1) {
    const row = rows[0];
    return {
      itemId: normalizeId(row[itemPk]),
      quantity: Math.max(1, Math.floor(normalizeNumber(row.quantity, 1))),
      error: null,
    };
  }

  // Auto-heal duplicate rows for the same product in one cart to keep +/- stable.
  const canonical = rows[0];
  const canonicalId = normalizeDbKey(canonical[itemPk]);
  const mergedQty = rows.reduce((sum, row) => {
    return sum + Math.max(1, Math.floor(normalizeNumber(row.quantity, 1)));
  }, 0);

  const { error: mergeError } = await supabase
    .from("cart_items")
    .update({ quantity: mergedQty })
    .eq(itemPk, canonicalId)
    .eq("cart_id", cartResult.cartId);
  if (mergeError) return { itemId: null, quantity: 0, error: mergeError };

  const duplicateIds = rows
    .slice(1)
    .map((row) => normalizeDbKey(row[itemPk]))
    .filter((id) => normalizeId(id).length > 0);
  if (duplicateIds.length > 0) {
    const { error: deleteDupError } = await supabase
      .from("cart_items")
      .delete()
      .in(itemPk, duplicateIds)
      .eq("cart_id", cartResult.cartId);
    if (deleteDupError) return { itemId: null, quantity: 0, error: deleteDupError };
  }

  return {
    itemId: normalizeId(canonical[itemPk]),
    quantity: mergedQty,
    error: null,
  };
}

export async function removeCartItemById(
  supabase: Supabase,
  userIdKey: string | number,
  cartItemId: string
): Promise<DbError> {
  const itemPk = await getCartItemPkColumn(supabase);
  const itemIdKey = normalizeDbKey(cartItemId);
  const cartResult = await getOrCreateCartId(supabase, userIdKey);
  if (cartResult.error || !cartResult.cartId) return cartResult.error ?? { message: "Could not resolve cart." };
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq(itemPk, itemIdKey)
    .eq("cart_id", cartResult.cartId);
  return error;
}

export async function addOrIncrementCartItem(
  supabase: Supabase,
  userIdKey: string | number,
  productId: string,
  quantity: number
): Promise<DbError> {
  const itemPk = await getCartItemPkColumn(supabase);
  const productPk = await getProductPkColumn(supabase);
  const qty = Math.max(1, Math.floor(Number(quantity)));
  const cartResult = await getOrCreateCartId(supabase, userIdKey);
  if (cartResult.error || !cartResult.cartId) return cartResult.error ?? { message: "Could not resolve cart." };
  const productIdKey = normalizeDbKey(productId);

  const productSelectAttempts = [
    `${productPk},price,stock,name,sku`,
    `${productPk},price,stock,name,product_sku`,
    `${productPk},price,stock,name`,
    `${productPk},price,stock`,
  ] as const;

  let productRow: ProductRow | null = null;
  for (const select of productSelectAttempts) {
    const { data, error } = await supabase
      .from("products")
      .select(select)
      .eq(productPk, productIdKey)
      .maybeSingle();
    if (!error) {
      productRow = (data as unknown as ProductRow) ?? null;
      break;
    }
    if (!isMissingColumn(error, "sku") && !isMissingColumn(error, "product_sku") && !isMissingColumn(error, "name")) {
      return error;
    }
  }

  if (!productRow) return { message: "Product not found." };

  const unitPrice = normalizeNumber(productRow.price, 0);
  const stock = productRow.stock == null ? null : normalizeNumber(productRow.stock, 0);
  if (stock != null && stock <= 0) return { message: "Product is out of stock." };
  const snapshotName = typeof productRow.name === "string" && productRow.name.trim() ? productRow.name.trim() : null;
  const snapshotSkuRaw = (productRow as Record<string, unknown>).sku ?? (productRow as Record<string, unknown>).product_sku;
  const snapshotSku = typeof snapshotSkuRaw === "string" && snapshotSkuRaw.trim() ? snapshotSkuRaw.trim() : null;

  const { data: existingSingle, error: existingSingleError } = await supabase
    .from("cart_items")
    .select(`${itemPk},cart_id,product_id,quantity`)
    .eq("cart_id", cartResult.cartId)
    .eq("product_id", productIdKey)
    .maybeSingle();
  if (existingSingleError && !isMultipleRowsError(existingSingleError)) return existingSingleError;

  let existingRows: CartItemRow[] = [];
  if (existingSingleError && isMultipleRowsError(existingSingleError)) {
    const { data: multipleRows, error: multipleRowsError } = await supabase
      .from("cart_items")
      .select(`${itemPk},cart_id,product_id,quantity`)
      .eq("cart_id", cartResult.cartId)
      .eq("product_id", productIdKey)
      .order(itemPk, { ascending: true });
    if (multipleRowsError) return multipleRowsError;
    existingRows = (Array.isArray(multipleRows) ? multipleRows : []) as unknown as CartItemRow[];
  } else if (existingSingle) {
    existingRows = [existingSingle as unknown as CartItemRow];
  }

  if (existingRows.length > 0) {
    const canonical = existingRows[0];
    const existingQty = existingRows.reduce((sum, row) => {
      return sum + Math.max(1, Math.floor(normalizeNumber(row.quantity, 1)));
    }, 0);
    const nextQtyRaw = existingQty + qty;
    const nextQty = stock != null ? Math.min(nextQtyRaw, Math.max(0, stock)) : nextQtyRaw;
    if (nextQty <= 0) return { message: "Product is out of stock." };

    const canonicalItemId = normalizeDbKey(canonical[itemPk]);
    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity: nextQty, unit_price: unitPrice, price_at_time: unitPrice })
      .eq(itemPk, canonicalItemId)
      .eq("cart_id", cartResult.cartId);
    if (updateError) return updateError;

    const duplicateIds = existingRows
      .slice(1)
      .map((row) => normalizeDbKey(row[itemPk]))
      .filter((id) => normalizeId(id).length > 0);
    if (duplicateIds.length > 0) {
      const { error: deleteDupError } = await supabase
        .from("cart_items")
        .delete()
        .in(itemPk, duplicateIds)
        .eq("cart_id", cartResult.cartId);
      if (deleteDupError) return deleteDupError;
    }

    return null;
  }

  const initialQty = stock != null ? Math.min(qty, Math.max(0, stock)) : qty;
  if (initialQty <= 0) return { message: "Product is out of stock." };

  const error = await insertCartItem(supabase, {
    cart_id: cartResult.cartId,
    user_id: userIdKey,
    product_id: productIdKey,
    product_name: snapshotName,
    sku: snapshotSku,
    quantity: initialQty,
    unit_price: unitPrice,
    price_at_time: unitPrice,
  });
  return error;
}

export async function finalizeCartAfterCheckout(
  supabase: Supabase,
  userIdKey: string | number
): Promise<DbError> {
  const cartPk = await getCartPkColumn(supabase);
  const active = await selectActiveCart(supabase, userIdKey);
  if (active.error) return active.error;
  if (!active.cart) return null;

  const cartId = normalizeId(active.cart[cartPk]);
  if (!cartId) return null;

  const { error: statusError } = await supabase
    .from("cart")
    .update({ status: "checked_out" })
    .eq(cartPk, normalizeDbKey(cartId))
    .eq("user_id", userIdKey);

  if (!statusError) return null;
  if (!isMissingColumn(statusError, "status")) return statusError;

  // Legacy schema fallback: no status column, so clear items from the current cart.
  const { error: clearError } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", normalizeDbKey(cartId));
  return clearError;
}
