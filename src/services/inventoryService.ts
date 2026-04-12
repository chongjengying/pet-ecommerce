import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getProducts } from "@/services/productService";
import type { Product } from "@/types";

type InventoryLogRow = {
  product_id?: string | number | null;
  stock_after?: number | string | null;
  created_at?: string | null;
};

export type InventorySnapshotItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  source: "inventory_logs" | "products";
  lastEventAt: string | null;
};

export type InventoryCategorySummary = {
  name: string;
  productCount: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
};

function normalizeCategory(product: Product): string {
  const value = String(product.category ?? "").trim();
  return value || "Uncategorized";
}

function normalizeStock(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function isMissingRelation(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    (msg.includes("table") && msg.includes("does not exist"))
  );
}

async function getLatestStockFromInventoryLogs(): Promise<
  Map<string, { stock: number; created_at: string | null }>
> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_logs")
    .select("product_id,stock_after,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    const message = typeof error.message === "string" ? error.message : "";
    if (isMissingRelation(message)) return new Map();
    throw error;
  }

  const rows = (Array.isArray(data) ? data : []) as InventoryLogRow[];
  const byProduct = new Map<string, { stock: number; created_at: string | null }>();
  for (const row of rows) {
    const productId = String(row.product_id ?? "").trim();
    if (!productId || byProduct.has(productId)) continue;
    byProduct.set(productId, {
      stock: normalizeStock(row.stock_after, 0),
      created_at: row.created_at ?? null,
    });
  }
  return byProduct;
}

export async function getInventorySnapshot(): Promise<InventorySnapshotItem[]> {
  const products = await getProducts().catch(() => []);
  const latestStockByProduct = await getLatestStockFromInventoryLogs().catch(() => new Map());

  return products.map((product) => {
    const id = String(product.id ?? "").trim();
    const fromLogs = latestStockByProduct.get(id);
    return {
      id,
      name: String(product.name ?? "Product"),
      category: normalizeCategory(product),
      stock: fromLogs ? fromLogs.stock : normalizeStock(product.stock, 0),
      source: fromLogs ? "inventory_logs" : "products",
      lastEventAt: fromLogs?.created_at ?? null,
    };
  });
}

export function summarizeInventoryCategories(
  snapshot: InventorySnapshotItem[]
): InventoryCategorySummary[] {
  const categoryMap = new Map<string, InventoryCategorySummary>();
  for (const item of snapshot) {
    const key = item.category;
    const current = categoryMap.get(key) ?? {
      name: key,
      productCount: 0,
      totalStock: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    };
    current.productCount += 1;
    current.totalStock += item.stock;
    if (item.stock <= 0) current.outOfStockCount += 1;
    else if (item.stock <= 5) current.lowStockCount += 1;
    categoryMap.set(key, current);
  }

  return Array.from(categoryMap.values()).sort((a, b) => {
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    return a.name.localeCompare(b.name);
  });
}
