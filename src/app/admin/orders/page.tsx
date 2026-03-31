import Link from "next/link";
import { getOrders } from "@/services/orderService";
import type { OrderRow } from "@/services/orderService";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function orderTotal(order: OrderRow) {
  if (order.total_amount != null && Number.isFinite(order.total_amount)) {
    return order.total_amount;
  }
  return (order.items ?? []).reduce(
    (sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 0),
    0
  );
}

function formatMoney(order: OrderRow, amount: number) {
  const currency = order.currency ?? "MYR";
  const prefix = currency === "MYR" ? "RM" : `${currency} `;
  return `${prefix}${amount.toFixed(2)}`;
}

export const metadata = {
  title: "Admin Orders – Paw & Co",
  description: "View and manage orders.",
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  let orders: OrderRow[] = [];
  let loadError: string | null = null;
  try {
    orders = await getOrders();
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to load orders";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-umber">Orders</h2>
        <p className="mt-1 text-sm text-umber/70">
          {orders.length} order{orders.length !== 1 ? "s" : ""} from checkout.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-medium text-red-800">Could not load orders</p>
          <p className="mt-1 text-sm text-red-700">{loadError}</p>
          <p className="mt-3 text-sm text-red-600">
            Check that the <code className="rounded bg-red-100 px-1">orders</code> and{" "}
            <code className="rounded bg-red-100 px-1">order_items</code> tables exist in Supabase and that RLS allows <strong>anon</strong> to <strong>SELECT</strong> (run <code className="rounded bg-red-100 px-1">supabase-orders-table.sql</code> in SQL Editor).
          </p>
          <Link
            href="/admin"
            className="mt-4 inline-block text-sm font-medium text-red-700 hover:underline"
          >
            ← Back to overview
          </Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-amber-200/60 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-umber/50">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="mt-4 font-medium text-umber">No orders yet</p>
            <p className="mt-1 text-sm text-umber/70">
              Complete a checkout on the shop to see orders here. Ensure the Supabase <code className="rounded bg-amber-100 px-1">orders</code> table exists.
            </p>
            <Link
              href="/admin"
              className="mt-6 inline-block text-sm font-medium text-terracotta hover:underline"
            >
              ← Back to overview
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-amber-200/60 bg-amber-50/50">
                  <th className="px-4 py-3 font-semibold text-umber">Order #</th>
                  <th className="px-4 py-3 font-semibold text-umber">Date</th>
                  <th className="px-4 py-3 font-semibold text-umber">Status</th>
                  <th className="px-4 py-3 font-semibold text-umber">Items</th>
                  <th className="px-4 py-3 font-semibold text-umber">Inventory</th>
                  <th className="px-4 py-3 font-semibold text-umber">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-amber-100 transition hover:bg-amber-50/30"
                  >
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-umber">
                      {order.order_number ?? order.id.slice(0, 8) + "…"}
                    </td>
                    <td className="px-4 py-3 text-umber/80">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-sage/20 px-2 py-0.5 text-xs font-medium text-sage">
                        {order.status ?? "completed"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="list-inside list-disc space-y-0.5 text-umber/80">
                        {(order.items ?? []).map((item, idx) => (
                          <li key={idx}>
                            <Link
                              href={`/products/${item.id}`}
                              className="text-terracotta hover:underline"
                            >
                              {item.name} × {item.quantity}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-umber/80">
                      {(order.inventory_log_count ?? 0) > 0 ? (
                        <span className="rounded-full bg-sage/20 px-2 py-0.5 text-xs font-medium text-sage">
                          Logged ({order.inventory_log_count})
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-umber">
                      <div>{formatMoney(order, orderTotal(order))}</div>
                      {Number(order.shipping_fee ?? 0) > 0 && (
                        <div className="text-xs font-normal text-umber/70">
                          Shipping: {formatMoney(order, Number(order.shipping_fee))}
                        </div>
                      )}
                      {Number(order.tax_amount ?? 0) > 0 && (
                        <div className="text-xs font-normal text-umber/70">
                          Tax: {formatMoney(order, Number(order.tax_amount))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
