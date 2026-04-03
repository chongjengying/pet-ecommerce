"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/grooming", label: "Dog Grooming" },
  { href: "/profile", label: "Profile" },
  { href: "/cart", label: "Cart" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount, openCartFlyout } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const syncAuthState = async () => {
      try {
        setAuthLoading(true);
        const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
        const res = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!active) return;
        if (!res.ok) {
          setIsAuthenticated(false);
          setUsername("");
          return;
        }
        const payload = (await res.json().catch(() => ({}))) as { user?: { username?: string } };
        setIsAuthenticated(true);
        setUsername(payload.user?.username ?? "");
      } catch {
        if (!active) return;
        setIsAuthenticated(false);
        setUsername("");
      } finally {
        if (!active) return;
        setAuthLoading(false);
      }
    };
    void syncAuthState();

    const onAuthChanged = () => {
      void syncAuthState();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "customer_jwt_token") {
        void syncAuthState();
      }
    };

    window.addEventListener("customer-auth-changed", onAuthChanged);
    window.addEventListener("storage", onStorage);

    return () => {
      active = false;
      window.removeEventListener("customer-auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("customer_jwt_token");
    window.dispatchEvent(new Event("customer-auth-changed"));
    setIsAuthenticated(false);
    setUsername("");
    setMenuOpen(false);
    router.replace("/");
    router.refresh();
  };

  const initials = useMemo(() => {
    const source = username.trim();
    if (!source) return "U";
    const parts = source.split(/[._\s-]+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || source.charAt(0).toUpperCase();
  }, [username]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-amber-200/60 bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 text-xl font-bold tracking-tight text-umber sm:text-2xl"
        >
          {!logoBroken ? (
            <img
              src="/logo.png"
              alt="PAWLUXE logo"
              className="h-9 w-9 rounded-full object-cover ring-1 ring-amber-300/60"
              onError={() => setLogoBroken(true)}
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-umber text-xs font-semibold text-amber-100">
              PL
            </span>
          )}
          <span>PAWLUXE</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="text-sm font-medium text-umber/80 transition hover:text-umber"
              >
                {label}
              </Link>
            </li>
          ))}
          <li>
            {authLoading ? (
              <span className="inline-block h-8 w-20 animate-pulse rounded-xl bg-amber-100" />
            ) : isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-umber ring-1 ring-amber-200 transition hover:bg-amber-200"
                  aria-label="Open profile menu"
                >
                  {initials}
                </button>
                <div
                  className={`absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border border-amber-100 bg-white p-2 shadow-xl transition duration-200 ${
                    menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
                  }`}
                >
                  <p className="px-3 py-2 text-sm font-semibold text-umber">@{username || "customer"}</p>
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-2 text-sm text-umber/90 transition hover:bg-amber-50"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-umber/90 transition hover:bg-amber-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/auth/login" className="text-sm font-medium text-umber/80 transition hover:text-umber">
                Login
              </Link>
            )}
          </li>
          <li>
            <button
              type="button"
              onClick={openCartFlyout}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-umber transition hover:bg-amber-200"
              aria-label="Open cart"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-terracotta text-xs font-semibold text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
          </li>
        </ul>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={openCartFlyout}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-umber"
            aria-label="Open cart"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-terracotta text-xs font-semibold text-white">
                {cartCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200 text-umber"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-amber-200/60 bg-cream px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-2">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-umber hover:bg-amber-100"
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              {!isAuthenticated ? (
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-umber hover:bg-amber-100"
                >
                  Login
                </Link>
              ) : null}
            </li>
            {isAuthenticated ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void onLogout();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-umber hover:bg-amber-100"
                >
                  Logout
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </header>
  );
}
