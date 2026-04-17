import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/adminSession";

const CUSTOMER_SESSION_COOKIE = "customer_session";

function decodeBase64UrlToString(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return null;
  }
}

function hasValidCustomerSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payloadRaw = decodeBase64UrlToString(parts[1]);
  if (!payloadRaw) return false;

  try {
    const payload = JSON.parse(payloadRaw) as { exp?: number; role?: string };
    if (typeof payload.exp !== "number") return false;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return false;
    if ((payload.role || "").toLowerCase() === "admin") return false;
    return true;
  } catch {
    return false;
  }
}

/** Cookie must be non-legacy and include userId (issued after admin login + role check). */
async function isValidAdminSessionToken(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token || !secret) return false;
  const session = await verifyAdminSessionToken(token, secret);
  if (!session.ok) return false;
  if ("legacy" in session && session.legacy) return false;
  return "userId" in session && Boolean(session.userId);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const secret = process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
  const customerToken = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  const hasCustomerSession = hasValidCustomerSessionToken(customerToken);

  const isApiAdmin = pathname.startsWith("/api/admin");
  const isPageAdmin = pathname.startsWith("/admin");
  const isCustomerLogin = pathname === "/auth/login";

  if (!isApiAdmin && !isPageAdmin && !isCustomerLogin) {
    return NextResponse.next();
  }

  if (isCustomerLogin) {
    if (hasCustomerSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/profile";
      return NextResponse.redirect(url);
    }

    if (secret) {
      const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
      const isAdmin = await isValidAdminSessionToken(adminToken, secret);
      if (isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin/auth/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin/auth/logout")) {
    return NextResponse.next();
  }

  if (isApiAdmin) {
    if (!secret) {
      return NextResponse.json(
        { error: "Admin auth not configured. Set ADMIN_SESSION_SECRET." },
        { status: 503 }
      );
    }
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const allowed = await isValidAdminSessionToken(token, secret);
    if (!token || !allowed) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login")) {
    const forbidden = request.nextUrl.searchParams.get("forbidden") === "1";
    if (forbidden) {
      const res = NextResponse.next();
      res.cookies.set(ADMIN_SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      return res;
    }
    if (secret) {
      const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
      const allowed = await isValidAdminSessionToken(token, secret);
      if (allowed) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  if (!secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("config", "1");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const allowed = await isValidAdminSessionToken(token, secret);
  if (!token || !allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/auth/login"],
};
