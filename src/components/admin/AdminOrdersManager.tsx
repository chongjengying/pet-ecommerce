"use client";

import { useState } from "react";
import type { OrderRow } from "@/services/orderService";
import AdminTable from "@/components/admin/ui/AdminTable";
import { useAdminToast } from "@/components/admin/ui/AdminToast";

const statuses = ["pending", "paid", "shipped"] as const;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function AdminOrdersManager({ orders }: { orders: OrderRow[] }) {
  const { pushToast } = useAdminToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>(
    Object.fromEntries(orders.map((order) => [order.id, (order.status || "pending").toLowerCase()]))
  );

  const onUpdateStatus = async (orderId: string) => {
    const status = localStatus[orderId] ?? "pending";
    setSavingId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to update order status.");
      pushToast("success", `Order status updated to ${status}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushToast("error", message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminTable
      columns={["Order ID", "Customer", "Total Price", "Status", "Date", "Items"]}
      minWidthClassName="min-w-[930px]"
      isEmpty={orders.length === 0}
      emptyState={<p className="text-sm text-zinc-500">No orders yet.</p>}
    >
      {orders.map((order) => (
        <tr key={order.id} className="border-b border-zinc-100 align-top">
          <td className="px-4 py-3 font-mono text-xs text-zinc-700">{order.order_number ?? order.id.slice(0, 8)}</td>
          <td className="px-4 py-3 text-zinc-700">Guest Checkout</td>
          <td className="px-4 py-3 font-medium text-zinc-900">RM {Number(order.total_amount ?? 0).toFixed(2)}</td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <select
                value={localStatus[order.id] ?? "pending"}
                onChange={(event) =>
                  setLocalStatus((prev) => ({ ...prev, [order.id]: event.target.value }))
                }
                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium uppercase text-zinc-700"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void onUpdateStatus(order.id)}
                disabled={savingId === order.id}
                className="rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
              >
                {savingId === order.id ? "Saving..." : "Update"}
              </button>
            </div>
          </td>
          <td className="px-4 py-3 text-zinc-500">{formatDate(order.created_at)}</td>
          <td className="px-4 py-3">
            <ul className="space-y-1 text-xs text-zinc-600">
              {(order.items ?? []).slice(0, 3).map((item, index) => (
                <li key={`${item.id}-${index}`}>
                  {item.name} x {item.quantity}
                </li>
              ))}
              {(order.items ?? []).length > 3 ? <li>+ {(order.items ?? []).length - 3} more</li> : null}
            </ul>
          </td>
        </tr>
      ))}
    </AdminTable>
  );
}
