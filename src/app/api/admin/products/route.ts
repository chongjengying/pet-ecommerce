import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServerWriteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!serviceKey && !anonKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  // Prefer service role for admin writes. Fallback to anon key if service key is not configured.
  return createClient(url, serviceKey || anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveOrCreateCategoryId(
  rawCategory: unknown
): Promise<string | number | null> {
  const categoryName =
    rawCategory == null ? "" : String(rawCategory).trim();
  if (!categoryName) return null;

  const db = getServerWriteClient();
  const categoryTables = ["categories", "category"];

  for (const table of categoryTables) {
    // 1) Try find existing category (exact match first).
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

    // 2) Insert when not found.
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

async function insertProductSafely(
  payload: Record<string, unknown>,
  protectedColumns: string[] = []
) {
  const db = getServerWriteClient();
  const insertPayload: Record<string, unknown> = { ...payload };
  const protectedSet = new Set(protectedColumns);

  for (let attempt = 0; attempt < 8; attempt++) {
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
      // Support products.categoryid, products.category_id, or products.category.
      // If one alias is missing, drop it and continue.
      // If all aliases are missing, fail with clear guidance.
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

async function syncProductImageSafely(payload: Record<string, unknown>) {
  const db = getServerWriteClient();
  const imageTables = ["product_images"];

  for (const table of imageTables) {
    const productId = payload.product_id as string | number | undefined;
    if (productId == null || productId === "") break;

    // 1) Try update existing primary image for this product.
    const updatePayload: Record<string, unknown> = { ...payload };
    delete updatePayload.product_id;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await db
        .from(table)
        .update(updatePayload)
        .eq("product_id", productId)
        .eq("is_main", true)
        .select("*");

      if (!error) {
        if (Array.isArray(data) && data.length > 0) return true;
        break; // no primary row exists -> insert below
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
        break; // try next table candidate
      }

      throw new Error(message);
    }

    // 2) Insert new primary image if update did not find one.
    const insertPayload: Record<string, unknown> = { ...payload };
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await db
        .from(table)
        .insert(insertPayload);

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
        // Try next table name candidate.
        break;
      }

      throw new Error(message);
    }
  }

  // No image table found; do not block product creation.
  return false;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      price?: number | string;
      category?: string | null;
      categoryid?: string | number | null;
      category_id?: string | number | null;
      stock?: number | string | null;
      image_url?: string | null;
    };

    const name = String(body?.name ?? "").trim();
    const price = Number(body?.price);
    const categoryIdFromPayload = body?.category_id ?? body?.categoryid;
    const categoryId =
      categoryIdFromPayload == null || categoryIdFromPayload === ""
        ? await resolveOrCreateCategoryId(body?.category)
        : String(categoryIdFromPayload).trim();
    const stock =
      body?.stock == null || body.stock === ""
        ? 0
        : Number(body.stock);
    const imageUrl = body?.image_url ? String(body.image_url) : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Price must be a valid number >= 0." }, { status: 400 });
    }
    if (!Number.isFinite(stock) || stock < 0) {
      return NextResponse.json({ error: "Stock must be a valid number >= 0." }, { status: 400 });
    }

    const created = await insertProductSafely(
      {
        name,
        price,
        category_id: categoryId,
        categoryid: categoryId,
        // Backward-compat fallback for older schemas.
        category: categoryId,
        stock,
        image_url: imageUrl,
        image: imageUrl,
      },
      ["name", "price", "stock"]
    );

    // Keep product_image table in sync with uploaded image URL.
    if (imageUrl) {
      const productId = (created as { id?: string | number })?.id;
      if (productId == null || productId === "") {
        throw new Error("Product created but missing product id for product_image insert.");
      }

      const imageInserted = await syncProductImageSafely({
        product_id: productId,
        image_url: imageUrl,
        is_main: true,
        sort_order: 0,
      });
      if (!imageInserted) {
        return NextResponse.json({
          success: true,
          product: created,
          warning: "Product created, but image table not found (expected public.product_image or public.product_images).",
        });
      }
    }

    return NextResponse.json({ success: true, product: created });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
