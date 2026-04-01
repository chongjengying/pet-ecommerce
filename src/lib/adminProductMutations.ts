import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function getServerWriteClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!serviceKey && !anonKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createClient(url, serviceKey || anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Match Supabase row id (numeric PK vs uuid string). */
export function coerceProductId(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}

export async function resolveOrCreateCategoryId(
  rawCategory: unknown
): Promise<string | number | null> {
  const categoryName =
    rawCategory == null ? "" : String(rawCategory).trim();
  if (!categoryName) return null;

  const db = getServerWriteClient();
  const categoryTables = ["categories", "category"];

  for (const table of categoryTables) {
    const { data: existing, error: existingError } = await db
      .from(table)
      .select("id,name")
      .eq("name", categoryName)
      .limit(1)
      .maybeSingle();

    if (!existingError && existing?.id != null) {
      return existing.id as string | number;
    }

    const existingMessage =
      typeof existingError?.message === "string" ? existingError.message : "";
    const missingTableOnSelect =
      existingMessage.includes("Could not find the table") ||
      existingMessage.includes("relation") ||
      existingMessage.includes("does not exist");
    if (existingError && missingTableOnSelect) {
      continue;
    }
    if (existingError && !missingTableOnSelect) {
      throw new Error(existingMessage || "Could not read category table.");
    }

    const { data: inserted, error: insertError } = await db
      .from(table)
      .insert({ name: categoryName })
      .select("id")
      .single();

    if (!insertError && inserted?.id != null) {
      return inserted.id as string | number;
    }

    const insertMessage =
      typeof insertError?.message === "string" ? insertError.message : "";
    const missingTableOnInsert =
      insertMessage.includes("Could not find the table") ||
      insertMessage.includes("relation") ||
      insertMessage.includes("does not exist");
    if (missingTableOnInsert) {
      continue;
    }
    if (insertError) {
      throw new Error(insertMessage || "Could not create category.");
    }
  }

  throw new Error(
    "Category table not found. Create 'public.categories' (or 'public.category') with columns: id, name."
  );
}

export async function insertProductSafely(
  payload: Record<string, unknown>,
  protectedColumns: string[] = []
) {
  const db = getServerWriteClient();
  const insertPayload: Record<string, unknown> = { ...payload };
  const protectedSet = new Set(protectedColumns);

  // One retry per unknown column removed; payload may include category aliases,
  // image aliases, and optional PDP columns — allow enough iterations for a minimal schema.
  const maxAttempts = 24;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await db
      .from("products")
      .insert(insertPayload)
      .select("*")
      .single();

    if (!error) return data;

    const message =
      typeof error.message === "string"
        ? error.message
        : JSON.stringify(error);

    const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i);
    const missingColumn = missingColumnMatch?.[1];
    const isCategoryAliasMissing =
      missingColumn === "categoryid" ||
      missingColumn === "category_id" ||
      missingColumn === "category";

    if (isCategoryAliasMissing) {
      const aliases = ["categoryid", "category_id", "category"];
      const otherAliasExists = aliases.some(
        (alias) => alias !== missingColumn && alias in insertPayload
      );
      if (!otherAliasExists) {
        throw new Error(
          "Products table is missing category column aliases ('categoryid', 'category_id', 'category'). " +
            "Add one of them in Supabase, then try again."
        );
      }
      delete insertPayload[missingColumn];
      continue;
    }

    if (missingColumn && protectedSet.has(missingColumn)) {
      throw new Error(
        `Missing required column '${missingColumn}' in products table. ` +
          "Please add it in Supabase before creating products from admin."
      );
    }
    if (!missingColumn || !(missingColumn in insertPayload)) {
      throw new Error(message);
    }
    delete insertPayload[missingColumn];
  }

  throw new Error("Could not insert product due to schema mismatch.");
}

export async function updateProductSafely(
  id: string | number,
  payload: Record<string, unknown>,
  protectedColumns: string[] = []
) {
  const db = getServerWriteClient();
  const updatePayload: Record<string, unknown> = { ...payload };
  const protectedSet = new Set(protectedColumns);
  const idKey = coerceProductId(String(id));

  const maxAttempts = 24;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await db
      .from("products")
      .update(updatePayload)
      .eq("id", idKey)
      .select("*")
      .single();

    if (!error) return data;

    const message =
      typeof error.message === "string"
        ? error.message
        : JSON.stringify(error);

    const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i);
    const missingColumn = missingColumnMatch?.[1];
    const isCategoryAliasMissing =
      missingColumn === "categoryid" ||
      missingColumn === "category_id" ||
      missingColumn === "category";

    if (isCategoryAliasMissing) {
      const aliases = ["categoryid", "category_id", "category"];
      const otherAliasExists = aliases.some(
        (alias) => alias !== missingColumn && alias in updatePayload
      );
      if (!otherAliasExists) {
        throw new Error(
          "Products table is missing category column aliases ('categoryid', 'category_id', 'category'). " +
            "Add one of them in Supabase, then try again."
        );
      }
      delete updatePayload[missingColumn];
      continue;
    }

    if (missingColumn && protectedSet.has(missingColumn)) {
      throw new Error(
        `Missing required column '${missingColumn}' in products table. ` +
          "Please add it in Supabase before updating products from admin."
      );
    }
    if (!missingColumn || !(missingColumn in updatePayload)) {
      throw new Error(message);
    }
    delete updatePayload[missingColumn];
  }

  throw new Error("Could not update product due to schema mismatch.");
}

export async function syncProductImageSafely(payload: Record<string, unknown>) {
  const db = getServerWriteClient();
  const imageTables = ["product_images"];

  for (const table of imageTables) {
    const productId = payload.product_id as string | number | undefined;
    if (productId == null || productId === "") break;

    const updatePayload: Record<string, unknown> = { ...payload };
    delete updatePayload.product_id;

    // 1) Update row marked as main image.
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await db
        .from(table)
        .update(updatePayload)
        .eq("product_id", productId)
        .eq("is_main", true)
        .select("*");

      if (!error) {
        if (Array.isArray(data) && data.length > 0) return true;
        break;
      }

      const message =
        typeof error.message === "string"
          ? error.message
          : JSON.stringify(error);
      const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i);
      const missingColumn = missingColumnMatch?.[1];
      if (missingColumn && missingColumn in updatePayload) {
        delete updatePayload[missingColumn];
        continue;
      }

      const missingRelation =
        message.includes("Could not find the table") ||
        message.includes("relation") ||
        message.includes("does not exist");
      if (missingRelation) {
        break;
      }

      throw new Error(message);
    }

    // 2) Update any existing row for this product (avoids duplicate insert when is_main was false).
    const broadPayload = { ...updatePayload };
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await db
        .from(table)
        .update(broadPayload)
        .eq("product_id", productId)
        .select("*");

      if (!error) {
        if (Array.isArray(data) && data.length > 0) return true;
        break;
      }

      const message =
        typeof error.message === "string"
          ? error.message
          : JSON.stringify(error);
      const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i);
      const missingColumn = missingColumnMatch?.[1];
      if (missingColumn && missingColumn in broadPayload) {
        delete broadPayload[missingColumn];
        continue;
      }

      const missingRelation =
        message.includes("Could not find the table") ||
        message.includes("relation") ||
        message.includes("does not exist");
      if (missingRelation) {
        break;
      }

      throw new Error(message);
    }

    // 3) Insert new primary image row.
    const insertPayload: Record<string, unknown> = { ...payload };
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await db.from(table).insert(insertPayload);

      if (!error) return true;

      const message =
        typeof error.message === "string"
          ? error.message
          : JSON.stringify(error);

      const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i);
      const missingColumn = missingColumnMatch?.[1];
      if (missingColumn && missingColumn in insertPayload) {
        delete insertPayload[missingColumn];
        continue;
      }

      const missingRelation =
        message.includes("Could not find the table") ||
        message.includes("relation") ||
        message.includes("does not exist");
      if (missingRelation) {
        break;
      }

      throw new Error(message);
    }
  }

  return false;
}

export async function deleteProductImagesForProduct(productId: string | number) {
  const db = getServerWriteClient();
  const pid = coerceProductId(String(productId));
  const imageTables = ["product_images"];

  for (const table of imageTables) {
    const { error } = await db.from(table).delete().eq("product_id", pid);
    const message = typeof error?.message === "string" ? error.message : "";
    const missingRelation =
      message.includes("Could not find the table") ||
      message.includes("relation") ||
      message.includes("does not exist");
    if (!error || missingRelation) {
      if (!error) return true;
      continue;
    }
    throw new Error(message);
  }
  return false;
}

export async function deleteRowsByProductId(
  table: string,
  productId: string | number,
  column = "product_id"
) {
  const db = getServerWriteClient();
  const pid = coerceProductId(String(productId));
  const { error } = await db.from(table).delete().eq(column, pid);
  const message = typeof error?.message === "string" ? error.message : "";
  const missingRelation =
    message.includes("Could not find the table") ||
    message.includes("relation") ||
    message.includes("does not exist");
  if (!error || missingRelation) return true;
  throw new Error(message);
}
