"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { getAvatarInitials, UserAvatar } from "@/components/ui/UserAvatar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { clearProfileCache } from "@/lib/profileCache";
import { consumeAuthFlash, setAuthFlash, type AuthFlashTone } from "@/lib/authFlash";

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
    { href: "/products", label: "Categories" },
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
  const searchParams = useSearchParams();
  const { cartCount, openCartFlyout } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [logoBroken, setLogoBroken] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendMessageTone, setResendMessageTone] = useState<AuthFlashTone>("info");
  const [resendBlockedUntil, setResendBlockedUntil] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<AuthFlashTone>("success");
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
          cache: "no-store",
          credentials: "same-origin",
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
          setIsEmailVerified(true);
          return;
        }
        const payload = (await res.json().catch(() => ({}))) as {
          user?: { username?: string; full_name?: string | null; email?: string; isEmailVerified?: boolean };
        };
        setIsAuthenticated(true);
        setUsername(payload.user?.username ?? "");
        setFullName(payload.user?.full_name ?? "");
        setEmail(payload.user?.email ?? "");
        setIsEmailVerified(payload.user?.isEmailVerified !== false);
      } catch {
        if (!active) return;
        setIsAuthenticated(false);
        setUsername("");
        setFullName("");
        setEmail("");
        setIsEmailVerified(true);
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
    const onWindowFocus = () => {
      void syncAuthState();
    };

    window.addEventListener("customer-auth-changed", onAuthChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      active = false;
      window.removeEventListener("customer-auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, []);

  useEffect(() => {
    const flash = consumeAuthFlash();
    if (!flash) return;
    setFlashMessage(flash.message);
    setFlashTone(flash.tone);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/products") return;
    setSearchTerm(searchParams.get("q") ?? "");
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!flashMessage) return;
    const timer = window.setTimeout(() => {
      setFlashMessage(null);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [flashMessage]);

  useEffect(() => {
    if (resendBlockedUntil <= Date.now()) return;
    const msUntilUnblock = resendBlockedUntil - Date.now();
    const timer = window.setTimeout(() => {
      setResendBlockedUntil(0);
    }, msUntilUnblock);
    return () => window.clearTimeout(timer);
  }, [resendBlockedUntil]);

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
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store", credentials: "same-origin" });
    clearProfileCache();
    localStorage.removeItem("customer_jwt_token");
    window.dispatchEvent(new Event("customer-auth-changed"));
    setAuthFlash("Signed out. Please sign in again to continue.", "info");
    setIsAuthenticated(false);
    setUsername("");
    setFullName("");
    setEmail("");
    setIsEmailVerified(true);
    setMenuOpen(false);
    setMobileOpen(false);
    router.replace("/auth/login");
    router.refresh();
  };

  const onResendVerificationEmail = async () => {
    if (resendBlockedUntil > Date.now()) {
      setResendMessageTone("error");
      setResendMessage("You've requested verification too many times. Please wait a few minutes before trying again.");
      return;
    }

    setResendMessage(null);
    setResendLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
      const response = await fetch("/api/auth/verification/resend", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
        alreadyVerified?: boolean;
        retryAfterSeconds?: number;
      };
      if (!response.ok || !payload.success) {
        if (response.status === 429) {
          const retryAfterSeconds =
            typeof payload.retryAfterSeconds === "number" ? Math.max(1, payload.retryAfterSeconds) : 300;
          setResendBlockedUntil(Date.now() + retryAfterSeconds * 1000);
          setResendMessageTone("error");
          setResendMessage("You've requested verification too many times. Please wait a few minutes before trying again.");
          return;
        }
        setResendMessageTone("error");
        setResendMessage(payload.error || "Could not resend verification email.");
        return;
      }
      if (payload.alreadyVerified) {
        setIsEmailVerified(true);
        setResendMessageTone("success");
        setResendMessage(payload.message || "Email is already verified.");
        return;
      }
      setResendMessageTone("success");
      setResendMessage(payload.message || "Verification email sent. Please check your inbox.");
    } catch {
      setResendMessageTone("error");
      setResendMessage("Could not resend verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
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

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchTerm.trim();
    const destination = query ? `/products?q=${encodeURIComponent(query)}` : "/products";
    router.push(destination);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-amber-200/80 bg-gradient-to-b from-cream via-cream to-amber-50/40 backdrop-blur supports-[backdrop-filter]:bg-cream/90">
      {!authLoading && isAuthenticated && !isEmailVerified ? (
        <div className="border-b border-amber-200 bg-amber-50/90">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm font-medium text-amber-900">Check your email to verify your account.</p>
            <button
              type="button"
              onClick={() => void onResendVerificationEmail()}
              disabled={resendLoading || resendBlockedUntil > Date.now()}
              className="inline-flex min-h-[36px] items-center justify-center rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendLoading ? "Sending..." : "Resend verification email"}
            </button>
          </div>
          {resendMessage ? (
            <div
              className={`mx-auto mb-2 w-full max-w-6xl rounded-xl border px-3 py-2 text-xs sm:px-6 ${
                resendMessageTone === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : resendMessageTone === "info"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
              role="status"
            >
              {resendMessage}
            </div>
          ) : null}
        </div>
      ) : null}
      {flashMessage ? (
        <div
          className={`mx-auto mt-2 w-[min(92%,560px)] rounded-2xl border px-4 py-2.5 text-center text-sm font-medium shadow-sm ${
            flashTone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : flashTone === "info"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
          role="status"
        >
          {flashMessage}
        </div>
      ) : null}
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

        <form
          onSubmit={onSearchSubmit}
          className="hidden w-full max-w-md items-center overflow-hidden rounded-full border border-amber-200/80 bg-white/95 shadow-sm ring-1 ring-transparent transition focus-within:border-sage/40 focus-within:ring-sage/20 lg:flex"
          role="search"
          aria-label="Search products"
        >
          <label htmlFor="header-search" className="sr-only">
            Search products
          </label>
          <span className="pl-4 text-umber/50" aria-hidden="true">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            id="header-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search pet products"
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-umber placeholder:text-umber/45 focus:outline-none"
          />
          <button
            type="submit"
            className="mr-1.5 rounded-full bg-sage/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sage"
          >
            Search
          </button>
        </form>

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
          <form
            onSubmit={onSearchSubmit}
            className="mb-3 flex items-center overflow-hidden rounded-xl border border-amber-200/80 bg-white shadow-sm ring-1 ring-transparent focus-within:border-sage/40 focus-within:ring-sage/20"
            role="search"
            aria-label="Search products"
          >
            <label htmlFor="header-search-mobile" className="sr-only">
              Search products
            </label>
            <span className="pl-3 text-umber/50" aria-hidden="true">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              id="header-search-mobile"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search pet products"
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-umber placeholder:text-umber/45 focus:outline-none"
            />
            <button
              type="submit"
              className="mr-1.5 rounded-lg bg-sage/90 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sage"
            >
              Go
            </button>
          </form>
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
