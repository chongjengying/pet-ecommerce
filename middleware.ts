import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/adminSession";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const secret = process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";

  const isApiAdmin = pathname.startsWith("/api/admin");
  const isPageAdmin = pathname.startsWith("/admin");

  if (!isApiAdmin && !isPageAdmin) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin/auth/login")) {
    return NextResponse.next();
  }

  if (isApiAdmin) {
    if (!secret || !password) {
      return NextResponse.json(
        { error: "Admin auth not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET." },
        { status: 503 }
      );
    }
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token || !(await verifyAdminSessionToken(token, secret))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login")) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (secret && password && token && (await verifyAdminSessionToken(token, secret))) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!secret || !password) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("config", "1");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !(await verifyAdminSessionToken(token, secret))) {
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
