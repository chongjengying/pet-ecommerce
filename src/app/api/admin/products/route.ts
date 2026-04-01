import { NextResponse } from "next/server";
import {
  insertProductSafely,
  resolveOrCreateCategoryId,
  syncProductImageSafely,
} from "@/lib/adminProductMutations";

function optionalText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
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
      size_label?: string | null;
      size?: string | null;
      color?: string | null;
      benefit?: string | null;
      ingredients?: string | null;
      feeding_instructions?: string | null;
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

    const sizeValue = optionalText(body.size_label ?? body.size);

    const created = await insertProductSafely(
      {
        name,
        price,
        category_id: categoryId,
        categoryid: categoryId,
        category: categoryId,
        stock,
        image_url: imageUrl,
        image: imageUrl,
        size_label: sizeValue,
        size: sizeValue,
        item_size: sizeValue,
        color: optionalText(body.color),
        benefit: optionalText(body.benefit),
        ingredients: optionalText(body.ingredients),
        feeding_instructions: optionalText(body.feeding_instructions),
      },
      ["name", "price", "stock"]
    );

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
          warning:
            "Product created, but image table not found (expected public.product_images).",
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
