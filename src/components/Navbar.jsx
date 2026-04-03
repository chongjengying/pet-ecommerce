"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

const menuItems = [
  { label: "Profile", href: "/profile" },
  { label: "Logout", action: "logout" },
];

export default function Navbar() {
  const { loading, user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const initials = useMemo(() => {
    if (!user) return "G";
    const base = user.fullName || user.username;
    return base
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((token) => token[0]?.toUpperCase() ?? "")
      .join("");
  }, [user]);

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-amber-200/60 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-umber">
          PAWLUXE
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/products" className="text-sm font-medium text-umber/70 hover:text-umber">
            Shop
          </Link>
          {loading ? (
            <div className="h-10 w-10 animate-pulse rounded-full bg-amber-100" />
          ) : user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-lg font-semibold text-umber transition hover:shadow-md"
                aria-label="Open account menu"
              >
                {initials || "P"}
              </button>
              <div
                className={`absolute right-0 top-12 w-48 rounded-2xl border border-amber-100 bg-white p-3 shadow-2xl transition-all duration-200 ${
                  open ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
                }`}
              >
                <p className="text-sm font-semibold text-umber">{user.username}</p>
                <div className="mt-3 space-y-2">
                  {menuItems.map((item) =>
                    item.action === "logout" ? (
                      <button
                        key={item.label}
                        onClick={handleLogout}
                        className="w-full rounded-xl border border-amber-100 px-3 py-2 text-left text-sm font-semibold text-umber transition hover:bg-amber-50"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-umber transition hover:bg-amber-50"
                      >
                        {item.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-2xl border border-amber-200 px-4 py-2 text-sm font-semibold text-umber transition hover:bg-amber-50"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
