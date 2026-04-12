"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types";
import AdminImageZoomViewer from "@/components/admin/AdminImageZoomViewer";

const configuredBucket =
  process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_BUCKET?.trim() ?? "";
const fallbackBuckets = ["pet_commerce", "product_image", "products", "PET_COMMERCE"];
const uploadBasePath = "product_image";
let cachedResolvedBucket: string | null = null;

async function resolveStorageBucket(): Promise<string> {
  if (cachedResolvedBucket) return cachedResolvedBucket;

  const candidates = [configuredBucket, ...fallbackBuckets].filter(
    (name, index, arr) => Boolean(name) && arr.indexOf(name) === index
  );

  for (const bucket of candidates) {
    const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
    const message = typeof error?.message === "string" ? error.message : "";
    const bucketMissing =
      message.includes("Bucket not found") || message.includes("bucket not found");
    if (!bucketMissing) {
      cachedResolvedBucket = bucket;
      return bucket;
    }
  }

  throw new Error(
    `Bucket not found. Checked: ${candidates.join(", ")}. ` +
      "Create one of these buckets in Supabase Storage or set NEXT_PUBLIC_SUPABASE_PRODUCT_BUCKET correctly."
  );
}

function getTodayStamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function buildDailyImageFilename(bucket: string, ext: string): Promise<string> {
  const today = getTodayStamp();
  const prefix = `${today}_PetImg`;
  const pattern = new RegExp(`^${prefix}(\\d{4})\\.[A-Za-z0-9]+$`);

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(uploadBasePath, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (error) throw error;

  let maxSeq = 0;
  for (const entry of data ?? []) {
    const match = pattern.exec(entry.name);
    if (!match) continue;
    const seq = Number(match[1]);
    if (Number.isFinite(seq)) {
      maxSeq = Math.max(maxSeq, seq);
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}.${ext}`;
}

interface AdminProductEditFormProps {
  product: Product;
}

export default function AdminProductEditForm({ product }: AdminProductEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [category, setCategory] = useState(product.category ?? "");
  const [stock, setStock] = useState(
    product.stock != null ? String(product.stock) : "0"
  );
  const [imageUrl, setImageUrl] = useState(
    product.image_url ?? product.image ?? ""
  );
  const [sizeLabel, setSizeLabel] = useState(product.size_label ?? product.size ?? "");
  const [color, setColor] = useState(product.color ?? "");
  const [benefit, setBenefit] = useState(product.benefit ?? "");
  const [ingredients, setIngredients] = useState(product.ingredients ?? "");
  const [feedingInstructions, setFeedingInstructions] = useState(
    product.feeding_instructions ?? ""
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const initialSnapshot = useMemo(
    () => ({
      name: product.name,
      price: String(product.price),
      category: product.category ?? "",
      stock: product.stock != null ? String(product.stock) : "0",
      imageUrl: product.image_url ?? product.image ?? "",
      sizeLabel: product.size_label ?? product.size ?? "",
      color: product.color ?? "",
      benefit: product.benefit ?? "",
      ingredients: product.ingredients ?? "",
      feedingInstructions: product.feeding_instructions ?? "",
    }),
    [product]
  );

  // When switching to another product (same mount), reset form from props.
  useEffect(() => {
    setName(product.name);
    setPrice(String(product.price));
    setCategory(product.category ?? "");
    setStock(product.stock != null ? String(product.stock) : "0");
    setImageUrl(product.image_url ?? product.image ?? "");
    setSizeLabel(product.size_label ?? product.size ?? "");
    setColor(product.color ?? "");
    setBenefit(product.benefit ?? "");
    setIngredients(product.ingredients ?? "");
    setFeedingInstructions(product.feeding_instructions ?? "");
  }, [product]);

  const priceNum = Number(price);
  const stockNum = Number(stock);
  const errors = useMemo(() => {
    return {
      name: name.trim().length === 0 ? "Name is required." : "",
      price:
        price.trim().length === 0
          ? "Price is required."
          : !Number.isFinite(priceNum) || priceNum < 0
            ? "Price must be a valid number >= 0."
            : "",
      stock:
        stock.trim().length === 0
          ? "Stock is required."
          : !Number.isFinite(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)
            ? "Stock must be a whole number >= 0."
            : "",
    };
  }, [name, price, stock, priceNum, stockNum]);

  const hasValidationErrors = Boolean(errors.name || errors.price || errors.stock);
  const hasUnsavedChanges =
    name !== initialSnapshot.name ||
    price !== initialSnapshot.price ||
    category !== initialSnapshot.category ||
    stock !== initialSnapshot.stock ||
    imageUrl !== initialSnapshot.imageUrl ||
    sizeLabel !== initialSnapshot.sizeLabel ||
    color !== initialSnapshot.color ||
    benefit !== initialSnapshot.benefit ||
    ingredients !== initialSnapshot.ingredients ||
    feedingInstructions !== initialSnapshot.feedingInstructions;

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || saving || uploading) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges, saving, uploading]);

  const onUpload = async (file: File) => {
    setToast(null);
    setUploading(true);
    try {
      const bucket = await resolveStorageBucket();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const filename = await buildDailyImageFilename(bucket, ext);
      const path = `${uploadBasePath}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }
      setImageUrl(data.publicUrl);
      setToast({ type: "success", message: "Image uploaded." });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setToast({
        type: "error",
        message:
          `Image upload failed: ${message}. ` +
          "If this says 'Bucket not found', verify your Supabase Storage bucket and NEXT_PUBLIC_SUPABASE_PRODUCT_BUCKET in .env.local.",
      });
    } finally {
      setUploading(false);
    }
  };

  const normalizeMoneyInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return value;
    return n.toFixed(2);
  };

  const normalizeStockInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return value;
    return String(Math.floor(n));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ name: true, price: true, stock: true });
    setToast(null);
    if (hasValidationErrors) {
      setToast({ type: "error", message: "Please fix highlighted fields before saving." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price,
          category,
          stock,
          image_url: imageUrl || null,
          size_label: sizeLabel.trim() || null,
          color: color.trim() || null,
          benefit: benefit.trim() || null,
          ingredients: ingredients.trim() || null,
          feeding_instructions: feedingInstructions.trim() || null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update product.");
      }

      const saved = data?.product as Product | undefined;
      if (saved && typeof saved === "object" && saved.id != null) {
        setName(saved.name);
        setPrice(String(saved.price));
        setCategory(saved.category ?? "");
        setStock(saved.stock != null ? String(saved.stock) : "0");
        setImageUrl(saved.image_url ?? saved.image ?? "");
        setSizeLabel(saved.size_label ?? saved.size ?? "");
        setColor(saved.color ?? "");
        setBenefit(saved.benefit ?? "");
        setIngredients(saved.ingredients ?? "");
        setFeedingInstructions(saved.feeding_instructions ?? "");
      }

      setToast({ type: "success", message: "Product updated." });
      setTouched({});
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setToast({ type: "error", message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-amber-200/60 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-umber">Edit product</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-umber/70">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-umber ${
              touched.name && errors.name ? "border-red-300" : "border-amber-200"
            }`}
            placeholder="Product name"
          />
          {touched.name && errors.name ? (
            <p className="text-xs font-medium text-red-600">{errors.name}</p>
          ) : null}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-umber/70">Price (RM)</span>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, price: true }));
              setPrice((prev) => normalizeMoneyInput(prev));
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-umber ${
              touched.price && errors.price ? "border-red-300" : "border-amber-200"
            }`}
            placeholder="0.00"
          />
          {touched.price && errors.price ? (
            <p className="text-xs font-medium text-red-600">{errors.price}</p>
          ) : null}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-umber/70">Category</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
            placeholder="Food, Toys, Grooming..."
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-umber/70">Stock</span>
          <input
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, stock: true }));
              setStock((prev) => normalizeStockInput(prev));
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-umber ${
              touched.stock && errors.stock ? "border-red-300" : "border-amber-200"
            }`}
          />
          {touched.stock && errors.stock ? (
            <p className="text-xs font-medium text-red-600">{errors.stock}</p>
          ) : null}
        </label>
      </div>

      <div className="space-y-3 border-t border-amber-100 pt-4">
        <p className="text-sm font-semibold text-umber">Product details (storefront)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-umber/70">Size</span>
            <input
              value={sizeLabel}
              onChange={(e) => setSizeLabel(e.target.value)}
              className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
              placeholder="e.g. 2 kg"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-umber/70">Color</span>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
              placeholder="e.g. Natural"
            />
          </label>
        </div>
        <label className="space-y-1 block">
          <span className="text-xs font-medium uppercase tracking-wide text-umber/70">Benefit</span>
          <textarea
            value={benefit}
            onChange={(e) => setBenefit(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
            placeholder="Key benefits"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs font-medium uppercase tracking-wide text-umber/70">Ingredients</span>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
            placeholder="Ingredients list"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs font-medium uppercase tracking-wide text-umber/70">
            Feeding instructions
          </span>
          <textarea
            value={feedingInstructions}
            onChange={(e) => setFeedingInstructions(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
            placeholder="How to feed"
          />
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-umber/70">Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(file);
          }}
          disabled={uploading}
          className="block w-full text-sm text-umber/80 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-umber hover:file:bg-amber-200"
        />
        {imageUrl ? (
          <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/40 p-2">
            <AdminImageZoomViewer
              src={imageUrl}
              alt={`${name || "Product"} preview`}
              thumbClassName="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-amber-50"
            />
            <p className="line-clamp-2 text-xs text-umber/70">{imageUrl}</p>
          </div>
        ) : null}
      </div>

      {toast ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="sticky bottom-3 z-20 flex justify-end rounded-xl border border-amber-200/60 bg-white/95 p-3 shadow-sm backdrop-blur">
        <button
          type="submit"
          disabled={saving || uploading || hasValidationErrors}
          className="rounded-xl bg-umber px-4 py-2 text-sm font-semibold text-white hover:bg-umber/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : uploading ? "Uploading..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
