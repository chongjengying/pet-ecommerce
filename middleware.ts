import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/adminSession";

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

  if (isApiAdmin) {
    if (!secret) {
      return NextResponse.json(
        { error: "Admin auth not configured. Set ADMIN_SESSION_SECRET." },
        { status: 503 }
      );
    }
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = token ? await verifyAdminSessionToken(token, secret) : { ok: false as const };
    if (!token || !session.ok) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login")) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (secret && token && (await verifyAdminSessionToken(token, secret))) {
      return NextResponse.redirect(new URL("/admin", request.url));
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
  const session = token ? await verifyAdminSessionToken(token, secret) : { ok: false as const };
  if (!token || !session.ok) {
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
