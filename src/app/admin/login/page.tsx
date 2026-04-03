import { Suspense } from "react";
import type { Metadata } from "next";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin sign in - PAWLUXE",
  description: "Sign in to the store admin.",
};

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={<div className="flex flex-1 items-center justify-center text-sm text-neutral-500">Loading...</div>}
    >
      <AdminLoginForm />
    </Suspense>
  );
}
