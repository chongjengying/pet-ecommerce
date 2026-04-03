import { NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customerJwt";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
