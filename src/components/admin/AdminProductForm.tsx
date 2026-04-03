"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types";
import { useAdminToast } from "@/components/admin/ui/AdminToast";

const configuredBucket = process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_BUCKET?.trim() ?? "";
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
    const bucketMissing = message.includes("Bucket not found") || message.includes("bucket not found");
    if (!bucketMissing) {
      cachedResolvedBucket = bucket;
      return bucket;
    }
  }
  throw new Error(`Bucket not found. Checked: ${candidates.join(", ")}`);
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
    if (Number.isFinite(seq)) maxSeq = Math.max(maxSeq, seq);
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}.${ext}`;
}

function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\n|,/g)
    .map((item) => item.replace(/^[\s\-*]+/, "").trim())
    .filter(Boolean);
}

function ListInput({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const addItem = () => {
    const next = draft.trim();
    if (!next) return;
    if (items.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...items, next]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(items.filter((entry) => entry !== item))}
            className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
            title="Remove item"
          >
            {item} x
          </button>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder}
          className="min-w-[12rem] flex-1 bg-transparent px-2 py-1.5 text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
        />
        <button
          type="button"
          onClick={addItem}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Add
        </button>
      </div>
    </div>
  );
}

interface AdminProductFormProps {
  mode: "create" | "edit";
  product?: Product;
  categoryOptions: string[];
}

export default function AdminProductForm({ mode, product, categoryOptions }: AdminProductFormProps) {
  const router = useRouter();
  const { pushToast } = useAdminToast();

  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : "0");
  const [category, setCategory] = useState(product?.category ?? categoryOptions[0] ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [benefits, setBenefits] = useState<string[]>(parseList(product?.benefit));
  const [ingredients, setIngredients] = useState<string[]>(parseList(product?.ingredients));
  const [images, setImages] = useState<string[]>(
    Array.from(
      new Set(
        [
          ...(product?.gallery_images ?? []),
          product?.image_url ?? "",
          product?.image ?? "",
        ].filter(Boolean)
      )
    )
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const primaryImage = images[0] ?? "";
  const isEdit = mode === "edit" && Boolean(product);

  const errors = useMemo(() => {
    const priceValue = Number(price);
    const stockValue = Number(stock);
    return {
      name: name.trim().length === 0 ? "Name is required." : "",
      price:
        price.trim().length === 0
          ? "Price is required."
          : !Number.isFinite(priceValue) || priceValue < 0
            ? "Price must be 0 or greater."
            : "",
      stock:
        stock.trim().length === 0
          ? "Stock is required."
          : !Number.isFinite(stockValue) || stockValue < 0 || !Number.isInteger(stockValue)
            ? "Stock must be a whole number 0 or greater."
            : "",
    };
  }, [name, price, stock]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const bucket = await resolveStorageBucket();
      const nextUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const filename = await buildDailyImageFilename(bucket, ext);
        const path = `${uploadBasePath}/${filename}`;
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (!data?.publicUrl) throw new Error("Upload succeeded but no URL returned.");
        nextUrls.push(data.publicUrl);
      }
      setImages((prev) => Array.from(new Set([...prev, ...nextUrls])));
      pushToast("success", `${nextUrls.length} image${nextUrls.length > 1 ? "s" : ""} uploaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushToast("error", `Image upload failed: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (errors.name || errors.price || errors.stock) {
      pushToast("error", "Please fix the form errors before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        price: Number(price),
        stock: Number(stock),
        category: category.trim() || null,
        description: description.trim() || null,
        benefit: benefits.join("\n"),
        ingredients: ingredients.join("\n"),
        image_url: primaryImage || null,
        gallery_images: images,
      };
      const endpoint =
        isEdit && product
          ? `/api/admin/products/${encodeURIComponent(String(product.id))}`
          : "/api/admin/products";
      const response = await fetch(endpoint, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to save product.");

      pushToast("success", isEdit ? "Product updated." : "Product created.");
      if (isEdit) {
        router.refresh();
      } else {
        router.push("/admin/products");
        router.refresh();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Salmon Meal Bites"
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
          />
          {errors.name ? <span className="text-xs text-red-600">{errors.name}</span> : null}
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-zinc-700">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
          >
            <option value="">Select category</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-zinc-700">Price</span>
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
          />
          {errors.price ? <span className="text-xs text-red-600">{errors.price}</span> : null}
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-zinc-700">Stock</span>
          <input
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            type="number"
            min="0"
            step="1"
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
          />
          {errors.stock ? <span className="text-xs text-red-600">{errors.stock}</span> : null}
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-sm font-medium text-zinc-700">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="Write a short product description..."
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <ListInput
          label="Benefits"
          items={benefits}
          onChange={setBenefits}
          placeholder="Type a benefit and press Enter"
        />
        <ListInput
          label="Ingredients"
          items={ingredients}
          onChange={setIngredients}
          placeholder="Type an ingredient and press Enter"
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-700">Images</label>
        <input
          type="file"
          multiple
          accept="image/*"
          disabled={uploading}
          onChange={(event) => void uploadFiles(event.target.files)}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-xl file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-700"
        />
        <p className="text-xs text-zinc-500">First image is used as the main product image.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((url, index) => (
            <div key={url} className="group relative overflow-hidden rounded-2xl border border-zinc-200">
              <img src={url} alt={`Product ${index + 1}`} className="h-28 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setImages((prev) => {
                      const next = prev.filter((item) => item !== url);
                      if (index === 0 && next.length > 0) return [next[0], ...next.slice(1)];
                      return next;
                    });
                  }}
                >
                  Remove
                </button>
                {index === 0 ? (
                  <span>Primary</span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setImages((prev) => [url, ...prev.filter((item) => item !== url)])
                    }
                  >
                    Set primary
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-100 pt-4">
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : uploading ? "Uploading..." : isEdit ? "Save Product" : "Create Product"}
        </button>
      </div>
    </form>
  );
}
