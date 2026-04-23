import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import {
  insertProductSafely,
  resolveOrCreateCategoryId,
  syncProductGalleryImages,
  syncProductImageSafely,
} from "@/lib/adminProductMutations";

function optionalText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toDecimalMoney(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return Math.round(n * 100) / 100;
}

function toOptionalBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (["true", "1", "yes", "active", "enabled", "published"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive", "disabled", "draft", "archived"].includes(normalized)) return false;
  }
  return null;
}

export async function POST(request: Request) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const body = (await request.json()) as {
      name?: string;
      price?: number | string;
      status?: string | null;
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
      description?: string | null;
      gallery_images?: string[] | null;
    };

    const name = String(body?.name ?? "").trim();
    const price = toDecimalMoney(body?.price);
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
    const normalizedStatus = optionalText(body?.status)?.toLowerCase() ?? null;
    const explicitActive = toOptionalBoolean(normalizedStatus);
    const isActive = explicitActive ?? true;
    const statusValue = isActive ? "active" : "inactive";
    const galleryImages = Array.isArray(body?.gallery_images)
      ? body.gallery_images.map((value) => String(value ?? "").trim()).filter(Boolean)
      : imageUrl
        ? [imageUrl]
        : [];

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
        status: statusValue,
        image_url: imageUrl,
        image: imageUrl,
        thumbnail_url: imageUrl,
        size_label: sizeValue,
        size: sizeValue,
        item_size: sizeValue,
        color: optionalText(body.color),
        benefit: optionalText(body.benefit),
        ingredients: optionalText(body.ingredients),
        feeding_instructions: optionalText(body.feeding_instructions),
        description: optionalText(body.description),
      },
      ["name", "price", "stock"]
    );

    const productId = (created as { id?: string | number })?.id;
    if (productId != null && productId !== "" && galleryImages.length > 0) {
      const gallerySynced = await syncProductGalleryImages(productId, galleryImages);
      if (!gallerySynced && imageUrl) {
        await syncProductImageSafely({
          product_id: productId,
          image_url: imageUrl,
          is_main: true,
          sort_order: 0,
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
