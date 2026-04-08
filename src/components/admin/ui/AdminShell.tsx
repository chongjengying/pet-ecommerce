"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
    <aside className="flex h-full flex-col bg-zinc-950">
      <div className="flex h-[4.25rem] items-center border-b border-white/[0.06] px-5">
        <Link href="/admin" onClick={close} className="flex items-center gap-3 outline-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-950/40">
            P
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-white">Pawluxe</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Admin</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
              }`}
            >
              <NavIcon path={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.06] p-3">
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to store
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
  const displayEmail = profile?.email?.trim() ?? "";
  const avatarInitials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";

  useEffect(() => {
    if (!sidebarOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-zinc-100 bg-[radial-gradient(ellipse_100%_60%_at_50%_-20%,rgba(16,185,129,0.07),transparent)] md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="hidden md:sticky md:top-0 md:block md:h-screen">
        <div className="h-full border-r border-white/[0.06] shadow-[4px_0_24px_-4px_rgba(0,0,0,0.25)]">
          <Sidebar />
        </div>
      </div>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 px-4 backdrop-blur-xl md:px-6">
          <div className="mx-auto flex h-[3.75rem] max-w-[1600px] items-center gap-3 md:h-16">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="rounded-xl border border-zinc-200/80 bg-white p-2 text-zinc-600 shadow-sm md:hidden"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">Console</p>
              <p className="truncate text-base font-semibold tracking-tight text-zinc-900">{pageTitle}</p>
            </div>
            <div className="hidden items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 px-3 py-1.5 shadow-sm sm:flex">
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-xs font-semibold text-white shadow-sm">
                      {avatarInitials}
                    </div>
                  )}
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-zinc-900">{displayName}</p>
                    {displayEmail ? (
                      <p className="truncate text-zinc-500" title={displayEmail}>
                        {displayEmail}
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            <AdminLogoutButton />
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Close menu"
          />
          <div className="absolute left-0 top-0 h-full w-[min(20rem,85vw)] shadow-2xl shadow-black/40">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg border border-white/10 bg-black/25 p-1.5 text-white"
              aria-label="Close navigation"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Sidebar close={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
