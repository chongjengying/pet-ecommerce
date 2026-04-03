import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createCustomerJwt, CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_MAX_AGE_SEC } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type LoginBody = {
  identifier?: string;
  email?: string;
  password?: string;
};

type LoginUserRow = {
  id: string | number;
  email: string;
  password: string;
  username: string;
  full_name: string | null;
  role: string | null;
};

const USER_SELECT_WITH_ROLE = "id, email, password, username, full_name, role";
const USER_SELECT_NO_ROLE = "id, email, password, username, full_name";

function normalizeUserRow(row: Record<string, unknown>): LoginUserRow {
  return {
    id: row.id as string | number,
    email: String(row.email ?? ""),
    password: String(row.password ?? ""),
    username: String(row.username ?? ""),
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    role: typeof row.role === "string" ? row.role : "customer",
  };
}

function isMissingRoleColumnError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("role") && message.includes("column");
}

function isMissingProfilesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("profiles") && (message.includes("does not exist") || message.includes("could not find"));
}

async function queryUserByEmailOrUsername(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  identifier: string
): Promise<{ user: LoginUserRow | null; error: string | null }> {
  const select = async (fields: string) => {
    const byEmail = await supabase
      .from("users")
      .select(fields)
      .ilike("email", identifier)
      .order("id", { ascending: true })
      .limit(1);
    if (byEmail.error) return { rows: null as Record<string, unknown>[] | null, error: byEmail.error };
    if (Array.isArray(byEmail.data) && byEmail.data.length > 0) {
      return { rows: byEmail.data as unknown as Record<string, unknown>[], error: null };
    }

    const byUsername = await supabase
      .from("users")
      .select(fields)
      .ilike("username", identifier)
      .order("id", { ascending: true })
      .limit(1);
    if (byUsername.error) return { rows: null as Record<string, unknown>[] | null, error: byUsername.error };
    return { rows: (byUsername.data as unknown as Record<string, unknown>[] | null) ?? null, error: null };
  };

  const firstAttempt = await select(USER_SELECT_WITH_ROLE);
  if (!firstAttempt.error) {
    const row = Array.isArray(firstAttempt.rows) && firstAttempt.rows.length > 0 ? firstAttempt.rows[0] : null;
    return { user: row ? normalizeUserRow(row) : null, error: null };
  }

  if (!isMissingRoleColumnError(firstAttempt.error)) {
    return { user: null, error: firstAttempt.error.message || "Could not validate login." };
  }

  const fallbackAttempt = await select(USER_SELECT_NO_ROLE);
  if (fallbackAttempt.error) {
    return { user: null, error: fallbackAttempt.error.message || "Could not validate login." };
  }
  const fallbackRow =
    Array.isArray(fallbackAttempt.rows) && fallbackAttempt.rows.length > 0 ? fallbackAttempt.rows[0] : null;
  return { user: fallbackRow ? normalizeUserRow(fallbackRow) : null, error: null };
}

function safeEqualPassword(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth API is not configured." },
      { status: 503 }
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rawIdentifier = String(body.identifier ?? body.email ?? "").trim();
  const identifier = rawIdentifier.toLowerCase();
  const password = String(body.password ?? "");

  if (!identifier || !password) {
    return NextResponse.json({ error: "Username/email and password are required." }, { status: 400 });
  }

  const lookupResult = await queryUserByEmailOrUsername(supabase, identifier);
  let user = lookupResult.user;
  const userLookupError = lookupResult.error;
  if (userLookupError) {
    return NextResponse.json({ error: userLookupError }, { status: 400 });
  }

  // Fallback for legacy data where username is stored in profiles table.
  if (!user) {
    const { data: profileRows, error: profileLookupError } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("username", identifier)
      .order("user_id", { ascending: true })
      .limit(1);
    if (profileLookupError) {
      if (isMissingProfilesTable(profileLookupError)) {
        return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      }
      return NextResponse.json({ error: profileLookupError.message || "Could not validate login." }, { status: 400 });
    }
    const profileUserId = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0]?.user_id : null;
    if (profileUserId != null) {
      const byProfileWithRole = await supabase
        .from("users")
        .select(USER_SELECT_WITH_ROLE)
        .eq("id", profileUserId)
        .maybeSingle();
      if (!byProfileWithRole.error && byProfileWithRole.data) {
        user = normalizeUserRow(byProfileWithRole.data as Record<string, unknown>);
      } else if (byProfileWithRole.error && isMissingRoleColumnError(byProfileWithRole.error)) {
        const byProfileWithoutRole = await supabase
          .from("users")
          .select(USER_SELECT_NO_ROLE)
          .eq("id", profileUserId)
          .maybeSingle();
        if (byProfileWithoutRole.error) {
          return NextResponse.json({ error: byProfileWithoutRole.error.message || "Could not validate login." }, { status: 400 });
        }
        user = byProfileWithoutRole.data ? normalizeUserRow(byProfileWithoutRole.data as Record<string, unknown>) : null;
      } else if (byProfileWithRole.error) {
        return NextResponse.json({ error: byProfileWithRole.error.message || "Could not validate login." }, { status: 400 });
      }
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
  }

  const savedPassword = String(user.password ?? "");
  if (!safeEqualPassword(password, savedPassword)) {
    return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
  }

  let token = "";
  try {
    token = await createCustomerJwt({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      role: user.role ?? "customer",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth API is not configured." },
      { status: 503 }
    );
  }

  const response = NextResponse.json({
    success: true,
    token,
    user: {
      id: String(user.id),
      email: user.email,
      username: user.username,
      full_name: user.full_name ?? null,
      role: user.role ?? "customer",
    },
  });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_SESSION_MAX_AGE_SEC,
  });

  return response;
}
