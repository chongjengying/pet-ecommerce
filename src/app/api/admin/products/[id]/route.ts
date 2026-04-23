import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import {
  coerceProductId,
  deleteProductImagesForProduct,
  deleteRowsByProductId,
  getServerWriteClient,
  resolveOrCreateCategoryId,
  syncProductGalleryImages,
  syncProductImageSafely,
  updateProductSafely,
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

type Body = {
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const { id: rawId } = await context.params;
    if (!rawId) {
      return NextResponse.json({ error: "Missing product id." }, { status: 400 });
    }

    const body = (await request.json()) as Body;

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
    const statusValue =
      normalizedStatus === "active" || normalizedStatus === "inactive"
        ? normalizedStatus
        : explicitActive == null
          ? null
          : explicitActive
            ? "active"
            : "inactive";
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

    const updated = await updateProductSafely(
      rawId,
      {
        name,
        price,
        category_id: categoryId,
        categoryid: categoryId,
        category: categoryId,
        stock,
        ...(statusValue != null ? { status: statusValue } : {}),
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

    const productId = (updated as { id?: string | number })?.id ?? coerceProductId(rawId);
    if (galleryImages.length > 0) {
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

    return NextResponse.json({ success: true, product: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const { id: rawId } = await context.params;
    if (!rawId) {
      return NextResponse.json({ error: "Missing product id." }, { status: 400 });
    }

    const idKey = coerceProductId(rawId);

    // Remove dependent rows first to satisfy FK constraints.
    await deleteRowsByProductId("order_items", idKey);
    await deleteRowsByProductId("inventory_logs", idKey);
    await deleteProductImagesForProduct(idKey);

    const db = getServerWriteClient();
    const { data, error } = await db
      .from("products")
      .delete()
      .eq("id", idKey)
      .select("id");

    if (error) {
      throw new Error(
        typeof error.message === "string" ? error.message : "Failed to delete product."
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
