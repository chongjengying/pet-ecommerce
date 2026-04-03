"use client";

import { useAdminAuth } from "@/components/admin/AdminAuthProvider";

export default function AdminLogoutButton() {
  const { logout, loading } = useAdminAuth();

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={loading}
      className="shrink-0 rounded-full border border-zinc-200/90 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
