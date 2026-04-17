"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Product } from "@/types";
import { resolveProductImageUrl } from "@/lib/productImage";
import AdminTable from "@/components/admin/ui/AdminTable";
import AdminModal from "@/components/admin/ui/AdminModal";
import AdminFilterBar from "@/components/admin/ui/AdminFilterBar";
import AdminStatCard from "@/components/admin/ui/AdminStatCard";
import { useAdminToast } from "@/components/admin/ui/AdminToast";

const PAGE_SIZE = 8;

type ProductStatusFilter = "all" | "active" | "low" | "out";

function inferStatus(stock: number | undefined) {
  if (!Number.isFinite(Number(stock))) return "active";
  const n = Number(stock);
  if (n <= 0) return "out";
  if (n <= 5) return "low";
  return "active";
}

export default function AdminProductsManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProductStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const status = inferStatus(product.stock);
      if (filter !== "all" && status !== filter) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        (product.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const onDeleteProduct = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(String(pendingDelete.id))}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete product.");
      }
      pushToast("success", `${pendingDelete.name} deleted.`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushToast("error", message);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminStatCard label="Total products" value={products.length} />
        <AdminStatCard label="Low stock" value={products.filter((product) => inferStatus(product.stock) === "low").length} />
        <AdminStatCard
          label="Out of stock"
          value={products.filter((product) => inferStatus(product.stock) === "out").length}
        />
      </div>

      <AdminFilterBar
        actions={
          <Link
            href="/admin/products/new"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-cyan-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-cyan-700 hover:to-teal-700"
          >
            Add product
          </Link>
        }
      >
          <label className="relative w-full max-w-xl">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or category"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none ring-cyan-500/20 transition placeholder:text-slate-400 focus:border-cyan-400/80 focus:bg-white focus:ring-4"
            />
          </label>
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as ProductStatusFilter);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-cyan-400/80 focus:ring-4 focus:ring-cyan-500/15"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
      </AdminFilterBar>

      <AdminTable
        columns={["Product", "Price", "Stock", "Status", "Category", "Actions"]}
        isEmpty={visible.length === 0}
        emptyState={<p className="text-sm text-slate-500">No products match your search.</p>}
      >
        {visible.map((product) => {
          const status = inferStatus(product.stock);
          return (
            <tr key={product.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <img
                    src={resolveProductImageUrl(product)}
                    alt={product.name}
                    className="h-12 w-12 rounded-xl border border-slate-100 object-cover shadow-sm"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{product.name}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400">{product.id}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 font-medium text-slate-900">RM {Number(product.price ?? 0).toFixed(2)}</td>
              <td className="px-4 py-3 text-slate-700">{product.stock ?? "-"}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    status === "out"
                      ? "bg-red-100 text-red-700"
                      : status === "low"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {status === "out" ? "Out of stock" : status === "low" ? "Low stock" : "Active"}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">{product.category || "-"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/products/${encodeURIComponent(String(product.id))}/edit`}
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-800"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(product)}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-red-600/90 transition hover:bg-red-50 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </AdminTable>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
        <span>
          Showing {filtered.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filtered.length)} of{" "}
          {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={currentPage >= pageCount}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <AdminModal
        open={Boolean(pendingDelete)}
        title="Delete Product?"
        description={
          pendingDelete
            ? `This will permanently remove ${pendingDelete.name} from your catalog.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setPendingDelete(null);
        }}
        onConfirm={() => void onDeleteProduct()}
      />
    </div>
  );
}
