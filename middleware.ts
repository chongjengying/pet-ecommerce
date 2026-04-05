import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/adminSession";

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

  const isApiAdmin = pathname.startsWith("/api/admin");
  const isPageAdmin = pathname.startsWith("/admin");

  if (!isApiAdmin && !isPageAdmin) {
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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
