"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { getAvatarInitials, UserAvatar } from "@/components/ui/UserAvatar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearProfileCache } from "@/lib/profileCache";

/**
 * Edit this object to change header links and labels — same idea as `footerConfig` in `Footer.tsx`.
 * Cart is only the icon on the right; list primary pages here (not duplicate Cart as text).
 */
export const headerConfig = {
  brand: {
    name: "PAWLUXE",
    logoSrc: "/logo.png",
    logoAlt: "PAWLUXE logo",
    /** Shown if logo image fails to load */
    monogram: "PL",
    homeHref: "/",
  },
  navLinks: [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
    { href: "/grooming", label: "Grooming" },
  ],
  auth: {
    loginHref: "/auth/login",
    loginLabel: "Sign in",
    signupHref: "/auth/signup",
    signupLabel: "Create account",
  },
} as const;

function linkIsActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount, openCartFlyout } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const cleanDisplayName = (value: string): string =>
    value
      .trim()
      .replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, "")
      .replace(/\s+/g, " ");

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
          setFullName("");
          setEmail("");
          return;
        }
        const payload = (await res.json().catch(() => ({}))) as {
          user?: { username?: string; full_name?: string | null; email?: string };
        };
        setIsAuthenticated(true);
        setUsername(payload.user?.username ?? "");
        setFullName(payload.user?.full_name ?? "");
        setEmail(payload.user?.email ?? "");
      } catch {
        if (!active) return;
        setIsAuthenticated(false);
        setUsername("");
        setFullName("");
        setEmail("");
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
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      router.prefetch("/profile");
    }
  }, [isAuthenticated, router]);

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
    clearProfileCache();
    localStorage.removeItem("customer_jwt_token");
    window.dispatchEvent(new Event("customer-auth-changed"));
    setIsAuthenticated(false);
    setUsername("");
    setFullName("");
    setEmail("");
    setMenuOpen(false);
    router.replace("/");
    router.refresh();
  };

  const displayName = useMemo(() => {
    const cleaned = cleanDisplayName(fullName);
    return cleaned || username.replace(/^@+/, "") || "Customer";
  }, [fullName, username]);

  const initials = useMemo(() => getAvatarInitials(displayName, username.trim() || "U"), [displayName, username]);

  const navLinkClass = (href: string) => {
    const active = linkIsActive(pathname, href);
    return [
      "relative rounded-lg px-2 py-1.5 text-sm font-medium transition",
      active ? "text-sage" : "text-umber/75 hover:text-umber",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage/50",
    ].join(" ");
  };

  const renderDesktopNavLink = (href: string, label: string) => {
    const active = linkIsActive(pathname, href);
    return (
      <Link
        href={href}
        className={navLinkClass(href)}
        aria-current={active ? "page" : undefined}
      >
        {label}
        {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-sage/80" aria-hidden="true" />}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-amber-200/80 bg-gradient-to-b from-cream via-cream to-amber-50/40 backdrop-blur supports-[backdrop-filter]:bg-cream/90">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6"
        aria-label="Primary"
      >
        <Link
          href={headerConfig.brand.homeHref}
          className="group flex min-w-0 shrink items-center gap-3 text-umber"
        >
          {!logoBroken ? (
            <img
              src={headerConfig.brand.logoSrc}
              alt={headerConfig.brand.logoAlt}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-amber-300/60 transition group-hover:ring-sage/40"
              onError={() => setLogoBroken(true)}
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-umber text-xs font-semibold text-amber-100">
              {headerConfig.brand.monogram}
            </span>
          )}
          <span className="truncate text-lg font-bold tracking-[0.08em] sm:text-xl">{headerConfig.brand.name}</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-1 md:flex">
          {headerConfig.navLinks.map(({ href, label }) => (
            <li key={href}>{renderDesktopNavLink(href, label)}</li>
          ))}
          <li className="ml-2 flex items-center border-l border-amber-200/80 pl-4">
            {authLoading ? (
              <span className="inline-block h-9 w-24 animate-pulse rounded-xl bg-amber-100/90" />
            ) : isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="rounded-full transition hover:opacity-[0.94] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage/50"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  aria-label={`Account menu, ${displayName || "signed in"}`}
                >
                  <UserAvatar
                    src={null}
                    alt={displayName ? `Avatar for ${displayName}` : "Account"}
                    initials={initials}
                    size="sm"
                  />
                </button>
                <div
                  className={`absolute right-0 mt-2 w-72 origin-top-right rounded-[28px] border border-amber-200/80 bg-[#fffdf8] p-6 shadow-[0_24px_60px_rgba(55,42,24,0.16)] ring-1 ring-amber-100/70 transition duration-150 ${
                    menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
                  }`}
                >
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-umber/65">
                    Signed in
                  </p>
                  <div className="mt-4 border-t border-dashed border-amber-300/90 pt-4">
                    <div className="flex items-start gap-4">
                      <div className="pt-0.5">
                        <span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-amber-300/80 bg-white px-2 text-sm font-semibold text-umber">
                          {initials}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-semibold tracking-tight text-umber">{displayName}</p>
                        <p className="mt-1 break-all text-sm text-umber/70">{email || "No email available"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 border-t border-dashed border-amber-300/90 pt-4">
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-base text-umber/90 transition hover:bg-amber-50"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/profile/orders"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-base text-umber/90 transition hover:bg-amber-50"
                    >
                      Orders
                    </Link>
                    <Link
                      href="/address-book"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-base text-umber/90 transition hover:bg-amber-50"
                    >
                      Addresses
                    </Link>
                    <button
                      type="button"
                      onClick={() => void onLogout()}
                      className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-base text-umber/90 transition hover:bg-amber-50"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href={headerConfig.auth.loginHref}
                  className="rounded-full px-3 py-2 text-sm font-medium text-umber/85 transition hover:bg-white/80 hover:text-umber"
                >
                  {headerConfig.auth.loginLabel}
                </Link>
                <Link
                  href={headerConfig.auth.signupHref}
                  className="rounded-full bg-sage/90 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sage"
                >
                  {headerConfig.auth.signupLabel}
                </Link>
              </div>
            )}
          </li>
          <li>
            <button
              type="button"
              onClick={openCartFlyout}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-umber shadow-sm ring-1 ring-amber-200/80 transition hover:bg-amber-50 hover:ring-sage/30"
              aria-label="Open cart"
            >
              <CartIcon className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-xs font-semibold text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
          </li>
        </ul>

        {/* Mobile: cart + menu */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={openCartFlyout}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-umber shadow-sm ring-1 ring-amber-200/80"
            aria-label="Open cart"
          >
            <CartIcon className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-xs font-semibold text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/90 bg-white/80 text-umber shadow-sm transition hover:border-sage/40"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
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

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="border-t border-amber-200/70 bg-gradient-to-b from-cream to-amber-50/30 px-4 py-4 md:hidden">
          <ul className="flex flex-col gap-1">
            {headerConfig.navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${
                    linkIsActive(pathname, href) ? "bg-white text-sage shadow-sm ring-1 ring-amber-100" : "text-umber hover:bg-white/70"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li className="my-2 border-t border-amber-200/60 pt-2">
              {authLoading ? (
                <div className="h-10 animate-pulse rounded-xl bg-amber-100/90" />
              ) : isAuthenticated ? (
                <>
                  <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-umber/45">Account</p>
                  <p className="px-3 py-1 text-sm font-semibold text-umber">{displayName}</p>
                  <p className="px-3 pb-1 text-xs text-umber/60">{email || username?.replace(/^@+/, "")}</p>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-medium text-umber hover:bg-white/80"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/profile/orders"
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-medium text-umber hover:bg-white/80"
                  >
                    Orders
                  </Link>
                  <Link
                    href="/address-book"
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-medium text-umber hover:bg-white/80"
                  >
                    Addresses
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      void onLogout();
                    }}
                    className="mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-umber hover:bg-white/80"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 px-1">
                  <Link
                    href={headerConfig.auth.loginHref}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-xl border border-amber-200/90 bg-white px-3 py-2.5 text-center text-sm font-medium text-umber shadow-sm"
                  >
                    {headerConfig.auth.loginLabel}
                  </Link>
                  <Link
                    href={headerConfig.auth.signupHref}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-xl bg-sage/90 px-3 py-2.5 text-center text-sm font-medium text-white shadow-sm"
                  >
                    {headerConfig.auth.signupLabel}
                  </Link>
                </div>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
