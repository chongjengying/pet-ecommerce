"use client";

import { useAdminAuth } from "@/components/admin/AdminAuthProvider";

export default function AdminLogoutButton() {
  const { logout, loading } = useAdminAuth();

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={loading}
      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
