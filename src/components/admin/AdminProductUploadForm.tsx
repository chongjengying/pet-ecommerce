"use client";

import { useState } from "react";
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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onUpload = async (file: File) => {
    setError(null);
    setSuccess(null);
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
      setSuccess("Image uploaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        `Image upload failed: ${message}. ` +
          "If this says 'Bucket not found', verify your Supabase Storage bucket and NEXT_PUBLIC_SUPABASE_PRODUCT_BUCKET in .env.local."
      );
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price,
          category,
          stock,
          image_url: imageUrl || null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save product.");
      }

      setSuccess("Product created.");
      setName("");
      setPrice("");
      setCategory("");
      setStock("0");
      setImageUrl("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
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
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
            placeholder="Product name"
          />
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
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
            placeholder="0.00"
          />
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
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-umber"
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

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {success ? <p className="text-sm font-medium text-green-700">{success}</p> : null}

      <button
        type="submit"
        disabled={saving || uploading}
        className="rounded-xl bg-umber px-4 py-2 text-sm font-semibold text-white hover:bg-umber/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving..." : uploading ? "Uploading..." : "Save Product"}
      </button>
    </form>
  );
}
