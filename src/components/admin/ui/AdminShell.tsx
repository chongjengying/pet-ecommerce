"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z" },
  { href: "/admin/products", label: "Products", icon: "M4 7l8-4 8 4-8 4-8-4zm0 0v10l8 4 8-4V7" },
  { href: "/admin/orders", label: "Orders", icon: "M9 5h6m-9 4h12m-12 4h12m-12 4h7" },
  { href: "/admin/categories", label: "Categories", icon: "M4 6h16M4 12h10M4 18h16" },
  { href: "/admin/customers", label: "Customers", icon: "M16 11a4 4 0 10-8 0m8 0a6 6 0 016 6v1H2v-1a6 6 0 016-6" },
  { href: "/admin/inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0v10l-8 4-8-4V7" },
  { href: "/admin/settings", label: "Settings", icon: "M10.3 3.4l.8-1.4h1.8l.8 1.4 1.5.6 1.5-.5 1.3 1.3-.5 1.5.6 1.5 1.4.8v1.8l-1.4.8-.6 1.5.5 1.5-1.3 1.3-1.5-.5-1.5.6-.8 1.4h-1.8l-.8-1.4-1.5-.6-1.5.5-1.3-1.3.5-1.5-.6-1.5L2 10.3V8.5l1.4-.8.6-1.5-.5-1.5L4.8 3.4l1.5.5 1.5-.6zM12 15.5A3.5 3.5 0 1012 8a3.5 3.5 0 000 7.5z" },
];

function NavIcon({ path }: { path: string }) {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={path} />
    </svg>
  );
}

function Sidebar({ close }: { close?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-zinc-200 px-5">
        <div className="rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
          Pawluxe
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? "bg-emerald-50 text-emerald-800" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <NavIcon path={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-3">
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Store
        </Link>
      </div>
    </aside>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, loading } = useAdminAuth();
  const pageTitle = useMemo(() => {
    const match = navItems.find((item) =>
      item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
    );
    return match?.label ?? "Dashboard";
  }, [pathname]);
  const displayName = profile?.username?.trim() || "Admin";
  const displayEmail = profile?.email?.trim() || "admin@pawluxe.com";
  const avatarInitials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";

  return (
    <div className="min-h-screen bg-[#f6f5f1]">
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:block md:w-64">
        <div className="h-full border-r border-zinc-200 bg-white">
          <Sidebar />
        </div>
      </div>

      <div className="md:pl-64">
        <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-zinc-200 p-2 text-zinc-600 md:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900">{pageTitle}</p>
            </div>
            <label className="hidden w-full max-w-xs items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 md:flex">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search products or orders..."
                className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
              />
            </label>
            <button
              type="button"
              className="rounded-xl border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-100"
              aria-label="Notifications"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.5 17h5l-1.4-1.4A2 2 0 0117.5 14V10a5.5 5.5 0 10-11 0v4a2 2 0 01-.6 1.6L4.5 17h5m5 0a3 3 0 11-6 0h6z" />
              </svg>
            </button>
            <div className="hidden items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-1.5 sm:flex">
              {loading ? (
                <>
                  <span className="h-8 w-8 animate-pulse rounded-full bg-zinc-200" />
                  <div className="space-y-1.5">
                    <p className="h-2.5 w-24 animate-pulse rounded bg-zinc-200" />
                    <p className="h-2.5 w-32 animate-pulse rounded bg-zinc-100" />
                  </div>
                </>
              ) : (
                <>
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                      {avatarInitials}
                    </div>
                  )}
                  <div className="text-xs">
                    <p className="font-semibold text-zinc-900">{displayName}</p>
                    <p className="text-zinc-500">{displayEmail}</p>
                  </div>
                </>
              )}
            </div>
            <AdminLogoutButton />
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">{children}</main>
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="h-full w-full bg-black/40"
            aria-label="Close menu"
          />
          <div className="h-full w-72 border-r border-zinc-200 bg-white shadow-2xl">
            <Sidebar close={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
