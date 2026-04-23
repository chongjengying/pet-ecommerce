"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
    const { error } = await supabase.storage
      .from(bucket)
      .list("", { limit: 1 });

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

export default function AdminProductUploadForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [color, setColor] = useState("");
  const [benefit, setBenefit] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [feedingInstructions, setFeedingInstructions] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(
        name.trim() ||
          price.trim() ||
          category.trim() ||
          stock !== "0" ||
          imageUrl.trim() ||
          sizeLabel.trim() ||
          color.trim() ||
          benefit.trim() ||
          ingredients.trim() ||
          feedingInstructions.trim()
      ),
    [
      name,
      price,
      category,
      stock,
      imageUrl,
      sizeLabel,
      color,
      benefit,
      ingredients,
      feedingInstructions,
    ]
  );

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
      const priceValue = Number(Number(price).toFixed(2));
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: priceValue,
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
        throw new Error(data?.error || "Failed to save product.");
      }

      setToast({ type: "success", message: "Product created." });
      setName("");
      setPrice("");
      setCategory("");
      setStock("0");
      setImageUrl("");
      setSizeLabel("");
      setColor("");
      setBenefit("");
      setIngredients("");
      setFeedingInstructions("");
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
      <h3 className="text-lg font-semibold text-umber">Add Product + Upload Image</h3>
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
            <img src={imageUrl} alt="Uploaded preview" className="h-16 w-16 rounded-md object-cover" />
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
          {saving ? "Saving..." : uploading ? "Uploading..." : "Save Product"}
        </button>
      </div>
    </form>
  );
}
