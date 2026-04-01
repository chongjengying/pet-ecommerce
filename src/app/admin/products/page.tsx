import Link from "next/link";
import { getProducts } from "@/services/productService";
import type { Product } from "@/types";
import { resolveProductImageUrl } from "@/lib/productImage";
import AdminProductUploadForm from "@/components/admin/AdminProductUploadForm";
import AdminProductDeleteButton from "@/components/admin/AdminProductDeleteButton";
import AdminImageZoomViewer from "@/components/admin/AdminImageZoomViewer";

export const metadata = {
  title: "Admin Products – Paw & Co",
  description: "Manage products.",
};

export default async function AdminProductsPage() {
  const products = await getProducts().catch(() => []);
  const list = Array.isArray(products) ? products : [];

  return (
    <div className="space-y-6">
      <AdminProductUploadForm />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-umber">Products</h2>
          <p className="mt-1 text-sm text-umber/70">{list.length} product{list.length !== 1 ? "s" : ""} in catalog.</p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex w-fit items-center justify-center rounded-xl bg-umber px-4 py-2.5 text-sm font-semibold text-white hover:bg-umber/90"
        >
          Add product
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-white shadow-sm">
        {list.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-umber/70">No products yet.</p>
            <Link
              href="/admin/products/new"
              className="mt-4 inline-block text-sm font-medium text-terracotta hover:underline"
            >
              Add your first product →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-amber-200/60 bg-amber-50/50">
                  <th className="px-4 py-3 font-semibold text-umber">Product</th>
                  <th className="px-4 py-3 font-semibold text-umber">Category</th>
                  <th className="px-4 py-3 font-semibold text-umber">Benefit</th>
                  <th className="px-4 py-3 font-semibold text-umber">Price</th>
                  <th className="px-4 py-3 font-semibold text-umber">Stock</th>
                  <th className="px-4 py-3 font-semibold text-umber">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p: Product) => (
                  <tr key={p.id} className="border-b border-amber-100 transition hover:bg-amber-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AdminImageZoomViewer
                          src={resolveProductImageUrl(p)}
                          alt={p.name}
                        />
                        <div className="min-w-0">
                          <span className="font-medium text-umber">{p.name}</span>
                          {((p.size_label ?? p.size)?.trim() || p.color?.trim()) ? (
                            <p className="mt-0.5 text-xs text-umber/60">
                              {[(p.size_label ?? p.size)?.trim(), p.color?.trim()].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-umber/70">{p.category ?? "—"}</td>
                    <td className="max-w-[220px] px-4 py-3 text-umber/70">
                      {p.benefit?.trim() ? (
                        <span className="line-clamp-2 text-xs" title={p.benefit.trim()}>
                          {p.benefit.trim()}
                        </span>
                      ) : (
                        <span className="text-umber/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-umber">RM{Number(p.price ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          p.stock != null && Number(p.stock) <= 5
                            ? "font-medium text-terracotta"
                            : "text-umber/80"
                        }
                      >
                        {p.stock != null ? p.stock : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className="font-medium text-umber/80 hover:text-umber hover:underline"
                        >
                          Edit
                        </Link>
                        <AdminProductDeleteButton productId={String(p.id)} productName={p.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
