import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  createAdminSessionToken,
  getAdminSessionSecret,
} from "@/lib/adminSession";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type AdminLoginBody = {
  identifier?: string;
  email?: string;
  password?: string;
};

type AdminUserRow = {
  id: string | number;
  email: string;
  username: string;
  password: string;
};

function safeEqualPassword(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function normalizeAdminUserRow(row: Record<string, unknown>): AdminUserRow {
  return {
    id: row.id as string | number,
    email: String(row.email ?? ""),
    username: String(row.username ?? ""),
    password: String(row.password ?? ""),
  };
}

function isMissingProfilesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("profiles") && (message.includes("does not exist") || message.includes("could not find"));
}

async function findUserByIdentifier(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  identifier: string
): Promise<{ user: AdminUserRow | null; error: string | null }> {
  const byEmail = await supabase
    .from("users")
    .select("id, email, username, password")
    .ilike("email", identifier)
    .order("id", { ascending: true })
    .limit(1);
  if (byEmail.error) {
    return { user: null, error: byEmail.error.message || "Could not validate admin login." };
  }
  if (Array.isArray(byEmail.data) && byEmail.data.length > 0) {
    return { user: normalizeAdminUserRow(byEmail.data[0] as Record<string, unknown>), error: null };
  }

  const byUsername = await supabase
    .from("users")
    .select("id, email, username, password")
    .ilike("username", identifier)
    .order("id", { ascending: true })
    .limit(1);
  if (byUsername.error) {
    return { user: null, error: byUsername.error.message || "Could not validate admin login." };
  }

  const row = Array.isArray(byUsername.data) && byUsername.data.length > 0 ? byUsername.data[0] : null;
  return { user: row ? normalizeAdminUserRow(row as Record<string, unknown>) : null, error: null };
}

async function resolveProfileRole(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string | number
): Promise<{ role: string | null; error: string | null }> {
  const byUserId = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", Number(userId))
    .maybeSingle();
  if (!byUserId.error) {
    const roleValue = byUserId.data && typeof byUserId.data.role === "string" ? byUserId.data.role : null;
    return { role: roleValue, error: null };
  }

  if (isMissingProfilesTable(byUserId.error)) {
    return { role: null, error: "Profiles table not found." };
  }

  const userIdErrMessage = String(byUserId.error.message ?? "").toLowerCase();
  if (!userIdErrMessage.includes("user_id") || !userIdErrMessage.includes("column")) {
    return { role: null, error: byUserId.error.message || "Could not validate admin role." };
  }

  const byId = await supabase
    .from("profiles")
    .select("role")
    .eq("id", Number(userId))
    .maybeSingle();
  if (byId.error) {
    if (isMissingProfilesTable(byId.error)) {
      return { role: null, error: "Profiles table not found." };
    }
    return { role: null, error: byId.error.message || "Could not validate admin role." };
  }

  const roleValue = byId.data && typeof byId.data.role === "string" ? byId.data.role : null;
  return { role: roleValue, error: null };
}

export async function POST(request: Request) {
  const sessionSecret = getAdminSessionSecret();
  if (!sessionSecret) {
    return NextResponse.json(
      { error: "Admin login is not configured. Set ADMIN_SESSION_SECRET in .env.local." },
      { status: 503 }
    );
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Admin auth API is not configured." },
      { status: 503 }
    );
  }

  let body: AdminLoginBody;
  try {
    body = (await request.json()) as AdminLoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? body.email ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return NextResponse.json({ error: "Username/email and password are required." }, { status: 400 });
  }

  const lookup = await findUserByIdentifier(supabase, identifier);
  if (lookup.error) {
    return NextResponse.json({ error: lookup.error }, { status: 400 });
  }
  if (!lookup.user) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  if (!safeEqualPassword(password, String(lookup.user.password ?? ""))) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  const roleCheck = await resolveProfileRole(supabase, lookup.user.id);
  if (roleCheck.error) {
    return NextResponse.json({ error: roleCheck.error }, { status: 400 });
  }
  if (roleCheck.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  const adminToken = await createAdminSessionToken(sessionSecret);
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, adminToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  });

  return response;
}
