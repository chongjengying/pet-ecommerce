import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionSecret,
  verifyAdminSessionToken,
} from "@/lib/adminSession";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET() {
  const secret = getAdminSessionSecret();
  if (!secret) {
    return NextResponse.json({ error: "Admin auth not configured." }, { status: 503 });
  }

  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const verified = await verifyAdminSessionToken(token, secret);
  if (!verified.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if ("legacy" in verified && verified.legacy) {
    return NextResponse.json({
      legacySession: true,
      username: null,
      email: null,
      id: null,
    });
  }

  if (!("userId" in verified)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { userId } = verified;
  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server not configured." },
      { status: 503 }
    );
  }

  const idNum = Number(userId);
  const idKey = Number.isFinite(idNum) ? idNum : userId;

  const { data, error } = await supabase
    .from("users")
    .select("id, email, username")
    .eq("id", idKey as string | number)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "Could not load admin user." }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const row = data as { id?: unknown; email?: unknown; username?: unknown };
  return NextResponse.json({
    legacySession: false,
    id: row.id != null ? String(row.id) : userId,
    email: typeof row.email === "string" ? row.email : null,
    username: typeof row.username === "string" ? row.username : null,
  });
}
