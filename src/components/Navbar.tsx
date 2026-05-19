"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useCart } from "@/context/CartContext";

type NavLink = { label: string; href: string };

const navLinks: NavLink[] = [
  { label: "Shop", href: "/products" },
  { label: "Catalog", href: "/catalog" },
  { label: "Grooming", href: "/grooming" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 21a8 8 0 10-16 0" />
      <circle cx="12" cy="8" r="4" strokeWidth={2} />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"
      />
      <circle cx="12" cy="10" r="2.5" strokeWidth={2} />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function useOnClickOutside<T extends HTMLElement>(ref: RefObject<T | null>, onOutside: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const node = ref.current;
      if (!node) return;
      if (e.target instanceof Node && node.contains(e.target)) return;
      onOutside();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [enabled, onOutside, ref]);
}

function AccountFlyout({
  open,
  onClose,
  onToggle,
  initials,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
  initials: string;
  onLogout: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(containerRef, onClose, open);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
      >
        {initials}
      </button>
      <div
        role="menu"
        aria-label="Account menu"
        className={`absolute right-0 top-12 w-64 rounded-2xl border border-black/10 bg-white p-3 shadow-2xl transition-all duration-200 ${
          open ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
        }`}
      >
        <div className="space-y-1">
          <Link
            role="menuitem"
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center text-black/70">
              <UserIcon className="h-4 w-4" />
            </span>
            Profile
          </Link>
          <Link
            role="menuitem"
            href="/address-book"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center text-black/70">
              <MapPinIcon className="h-4 w-4" />
            </span>
            Address book
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-xl border border-black/10 px-3 py-2.5 text-left text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center text-[#ef4444]">
              <LogoutIcon className="h-4 w-4" />
            </span>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileMenu({
  open,
  onClose,
  onOpenCart,
  cartCount,
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  isAuthenticated,
  authLoading,
  initials,
  username,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCart: () => void;
  cartCount: number;
  searchTerm: string;
  onSearchTermChange: (v: string) => void;
  onSearchSubmit: () => void;
  isAuthenticated: boolean;
  authLoading: boolean;
  initials: string;
  username: string;
  onLogout: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[90] md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        className={`absolute inset-0 bg-black/30 backdrop-blur-[1px] transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 h-full w-[88%] max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
            <p className="text-sm font-black tracking-[-0.04em] text-black">Menu</p>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
              aria-label="Close"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit();
              }}
              className="flex items-center rounded-2xl border border-black/10 bg-white px-3 py-2"
            >
              <input
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                placeholder="Search products..."
                type="search"
                className="w-full bg-transparent text-sm outline-none"
              />
              <button
                type="submit"
                className="ml-2 rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white"
              >
                Search
              </button>
            </form>

            <nav className="mt-5 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-6 rounded-2xl border border-black/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-black/50">Quick actions</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCart();
                  }}
                  className="relative flex flex-1 items-center justify-center gap-2 rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white"
                >
                  <CartIcon className="h-4 w-4" />
                  Cart
                  {cartCount > 0 ? (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </button>
                {authLoading ? (
                  <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-xl bg-black/10" />
                ) : isAuthenticated ? (
                  <div className="flex flex-1 items-center justify-between gap-2 rounded-xl border border-black/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-black">{username}</p>
                      <Link
                        href="/profile"
                        onClick={onClose}
                        className="text-xs font-semibold text-black/60 hover:underline"
                      >
                        View profile
                      </Link>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                      {initials}
                    </div>
                  </div>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={onClose}
                    className="flex flex-1 items-center justify-center rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
                  >
                    Sign in
                  </Link>
                )}
              </div>

              {isAuthenticated && !authLoading ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-left text-sm font-semibold text-black/80 hover:bg-black/5 hover:text-black"
                >
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { loading: authLoading, user, logout, isAuthenticated } = useAuth() as {
    loading: boolean;
    user: null | { username?: string; fullName?: string; email?: string };
    logout: (opts?: { redirect?: boolean }) => void;
    isAuthenticated: boolean;
  };
  const { cartCount, openCartFlyout } = useCart();

  const [searchTerm, setSearchTerm] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [mobileOpen]);

  const username = useMemo(() => user?.username ?? user?.email ?? "Account", [user]);
  const initials = useMemo(() => {
    if (!user) return "G";
    const base = String(user.fullName || user.username || user.email || "Guest");
    const tokens = base.split(" ").filter(Boolean);
    const firstTwo = tokens.slice(0, 2);
    const result = firstTwo.map((t) => t[0]?.toUpperCase() ?? "").join("");
    return result || "P";
  }, [user]);

  const onSearchSubmit = () => {
    const q = searchTerm.trim();
    if (!q) return;
    setAccountMenuOpen(false);
    setMobileOpen(false);
    router.push(`/products?q=${encodeURIComponent(q)}`);
  };

  const onLogout = () => {
    setAccountMenuOpen(false);
    setMobileOpen(false);
    logout({ redirect: true });
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full px-3 pt-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-xl backdrop-blur-xl">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-black tracking-[-0.04em] text-black"
            onClick={() => {
              setMobileOpen(false);
              setAccountMenuOpen(false);
            }}
          >
            <span className="text-2xl">🐾</span>
            PAWLUXE
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-black/70 transition hover:text-black"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit();
              }}
              className="hidden items-center rounded-full border border-black/10 bg-white px-3 py-2 lg:flex"
            >
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                type="search"
                className="w-44 bg-transparent text-sm outline-none"
              />
              <button
                type="submit"
                className="ml-2 rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white"
              >
                Search
              </button>
            </form>

            {!authLoading && isAuthenticated ? (
              <AccountFlyout
                open={accountMenuOpen}
                onClose={() => setAccountMenuOpen(false)}
                onToggle={() => setAccountMenuOpen((p) => !p)}
                initials={initials}
                onLogout={onLogout}
              />
            ) : (
              <Link href="/auth/login" className="hidden text-sm font-semibold text-black/70 md:block">
                Sign in
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                openCartFlyout();
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black text-white"
              aria-label="Open cart"
            >
              <CartIcon className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {cartCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                setMobileOpen((p) => !p);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/80 md:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <HamburgerIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onOpenCart={openCartFlyout}
        cartCount={cartCount}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={onSearchSubmit}
        isAuthenticated={Boolean(isAuthenticated)}
        authLoading={Boolean(authLoading)}
        initials={initials}
        username={username}
        onLogout={onLogout}
      />
    </>
  );
}
