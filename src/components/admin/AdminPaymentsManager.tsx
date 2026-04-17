"use client";

import { useEffect, useMemo, useState } from "react";
import AdminFilterBar from "@/components/admin/ui/AdminFilterBar";
import AdminStatCard from "@/components/admin/ui/AdminStatCard";
import AdminTable from "@/components/admin/ui/AdminTable";
import { useAdminToast } from "@/components/admin/ui/AdminToast";
import { formatDateTimeKualaLumpur } from "@/lib/dateTime";

type PaymentRow = {
  id: string;
  order_id: string;
  transaction_id: string | null;
  reference_no: string | null;
  payment_method: string | null;
  provider: string | null;
  amount: number;
  currency: string;
  refund_amount: number;
  status: string;
  paid_at: string | null;
  review_status: string | null;
  notes: string | null;
  created_at: string | null;
};

function fmtCurrency(v: number, c: string) {
  try {
    return new Intl.NumberFormat("en-MY", { style: "currency", currency: c || "MYR" }).format(Number(v || 0));
  } catch {
    return `${c || "MYR"} ${Number(v || 0).toFixed(2)}`;
  }
}

function fmtDate(v: string | null) {
  return formatDateTimeKualaLumpur(v);
}

export default function AdminPaymentsManager() {
  const { pushToast } = useAdminToast();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/payments", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { payments?: PaymentRow[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Could not load payments.");
        if (!active) return;
        setPayments(Array.isArray(data.payments) ? data.payments : []);
      } catch (error) {
        if (!active) return;
        pushToast("error", error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [pushToast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((payment) => {
      if (statusFilter !== "all" && payment.status !== statusFilter) return false;
      if (reviewFilter !== "all" && (payment.review_status ?? "pending") !== reviewFilter) return false;
      if (!q) return true;
      return (
        payment.order_id.toLowerCase().includes(q) ||
        (payment.transaction_id ?? "").toLowerCase().includes(q) ||
        (payment.reference_no ?? "").toLowerCase().includes(q)
      );
    });
  }, [payments, query, reviewFilter, statusFilter]);

  const totals = useMemo(() => {
    const totalAmount = filtered.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const refundedAmount = filtered.reduce((sum, row) => sum + Number(row.refund_amount || 0), 0);
    return {
      totalAmount,
      refundedAmount,
      paidCount: filtered.filter((row) => row.status === "paid").length,
      pendingReview: filtered.filter((row) => (row.review_status ?? "pending") === "pending").length,
    };
  }, [filtered]);

  const updateReview = async (id: string, reviewStatus: string) => {
    try {
      setSavingId(id);
      const res = await fetch(`/api/admin/payments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_status: reviewStatus }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; payment?: PaymentRow };
      if (!res.ok) throw new Error(data.error || "Could not update review.");
      setPayments((prev) =>
        prev.map((payment) => (payment.id === id ? { ...payment, review_status: reviewStatus } : payment))
      );
      pushToast("success", "Review status updated.");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="Payments" value={filtered.length} />
        <AdminStatCard label="Paid Count" value={totals.paidCount} />
        <AdminStatCard label="Gross" value={fmtCurrency(totals.totalAmount, "MYR")} />
        <AdminStatCard label="Refunded" value={fmtCurrency(totals.refundedAmount, "MYR")} hint={`${totals.pendingReview} pending reviews`} />
      </section>

      <AdminFilterBar>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search order, transaction, or reference"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
        >
          <option value="all">All payment status</option>
          <option value="paid">paid</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
          <option value="refunded">refunded</option>
          <option value="partially_refunded">partially_refunded</option>
        </select>
        <select
          value={reviewFilter}
          onChange={(event) => setReviewFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
        >
          <option value="all">All review status</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
      </AdminFilterBar>

      <AdminTable
        columns={["Order", "Transaction", "Method", "Amount", "Status", "Review", "Paid At"]}
        minWidthClassName="min-w-[1080px]"
        loading={loading}
        isEmpty={!loading && filtered.length === 0}
        emptyState={<p className="text-sm text-slate-500">No payments found.</p>}
      >
        {filtered.map((payment) => (
          <tr key={payment.id} className="border-b border-slate-100">
            <td className="px-4 py-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">{payment.order_id}</p>
              <p className="text-slate-500">{payment.reference_no ?? "-"}</p>
            </td>
            <td className="px-4 py-3 text-xs text-slate-600">{payment.transaction_id ?? "-"}</td>
            <td className="px-4 py-3 text-xs text-slate-700">
              <p>{payment.payment_method ?? "-"}</p>
              <p className="text-slate-500">{payment.provider ?? "-"}</p>
            </td>
            <td className="px-4 py-3 text-sm font-semibold text-slate-900">
              {fmtCurrency(payment.amount, payment.currency || "MYR")}
              {payment.refund_amount > 0 ? (
                <p className="text-xs font-medium text-amber-700">Refunded: {fmtCurrency(payment.refund_amount, payment.currency || "MYR")}</p>
              ) : null}
            </td>
            <td className="px-4 py-3 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{payment.status}</span>
            </td>
            <td className="px-4 py-3">
              <select
                value={payment.review_status ?? "pending"}
                onChange={(event) => void updateReview(payment.id, event.target.value)}
                disabled={savingId === payment.id}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </td>
            <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(payment.paid_at ?? payment.created_at)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
