"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface AdminProductDeleteButtonProps {
  productId: string;
  productName: string;
}

export default function AdminProductDeleteButton({
  productId,
  productName,
}: AdminProductDeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const ok = window.confirm(
      `Delete “${productName}”? This cannot be undone.`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Delete failed.");
      }
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      window.alert(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={deleting}
      className="font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
