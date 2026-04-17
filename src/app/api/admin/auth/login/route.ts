import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  createAdminSessionToken,
  getAdminSessionSecret,
} from "@/lib/adminSession";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { isAdminRole, resolveProfileRole } from "@/lib/userRole";
import { isUserAccountActive } from "@/lib/userAccountState";
import { updateUserLastLoginAt } from "@/lib/userLoginAudit";

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
  password_hash?: string;
};

function safeEqualPassword(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

async function verifyPassword(input: string, stored: string): Promise<boolean> {
  const normalizedStored = stored.trim();
  const hashLike = /^\$2[aby]\$\d{2}\$/.test(normalizedStored);
  if (hashLike) {
    try {
      return await bcrypt.compare(input, normalizedStored);
    } catch {
      return false;
    }
  }
  return safeEqualPassword(input, normalizedStored);
}

function normalizeAdminUserRow(row: Record<string, unknown>): AdminUserRow {
  const email = String(row.email ?? "").trim().toLowerCase();
  const usernameRaw = typeof row.username === "string" ? row.username.trim() : "";
  return {
    id: row.id as string | number,
    email,
    username: usernameRaw || (email.includes("@") ? email.split("@")[0] : email || "admin"),
    password: typeof row.password === "string" ? row.password : "",
    password_hash: typeof row.password_hash === "string" ? row.password_hash : undefined,
  };
}

function isMissingColumnError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("could not find") || message.includes("does not exist"));
}

function isMissingRelationOrColumn(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("table") && message.includes("could not find")) ||
    isMissingColumnError(error)
  );
}

async function hasAdminRoleAssigned(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string | number
): Promise<{ isAdmin: boolean; error: string | null }> {
  // 1) Preferred mapping table path
  const mapped = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId)
    .limit(10);

  if (!mapped.error) {
    const rows = Array.isArray(mapped.data) ? mapped.data : [];
    const isAdmin = rows.some((row) => {
      const rolesValue = (row as { roles?: unknown }).roles;
      const roleNames = Array.isArray(rolesValue)
        ? rolesValue.map((entry) => String((entry as { name?: unknown })?.name ?? "").trim().toLowerCase())
        : [String((rolesValue as { name?: unknown } | null)?.name ?? "").trim().toLowerCase()];
      return roleNames.some((name) => name === "admin");
    });
    if (isAdmin) return { isAdmin: true, error: null };
  } else if (!isMissingRelationOrColumn(mapped.error)) {
    return { isAdmin: false, error: mapped.error.message || "Could not verify admin role." };
  }

  // 2) Fallback mapping query (without join relation support)
  const ur = await supabase.from("user_roles").select("role_id").eq("user_id", userId).limit(20);
  if (!ur.error && Array.isArray(ur.data) && ur.data.length > 0) {
    const roleIds = ur.data
      .map((row) => (row as { role_id?: unknown }).role_id)
      .filter((v): v is number => typeof v === "number");
    if (roleIds.length > 0) {
      const roles = await supabase.from("roles").select("id,name").in("id", roleIds);
      if (!roles.error && Array.isArray(roles.data)) {
        const isAdmin = roles.data.some(
          (row) => String((row as { name?: unknown }).name ?? "").trim().toLowerCase() === "admin"
        );
        if (isAdmin) return { isAdmin: true, error: null };
      } else if (roles.error && !isMissingRelationOrColumn(roles.error)) {
        return { isAdmin: false, error: roles.error.message || "Could not verify admin role." };
      }
    }
  } else if (ur.error && !isMissingRelationOrColumn(ur.error)) {
    return { isAdmin: false, error: ur.error.message || "Could not verify admin role." };
  }

  // 3) Legacy users.role fallback
  const legacy = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!legacy.error && legacy.data) {
    const role = String((legacy.data as { role?: unknown }).role ?? "").trim().toLowerCase();
    return { isAdmin: role === "admin", error: null };
  }
  if (legacy.error && !isMissingRelationOrColumn(legacy.error)) {
    return { isAdmin: false, error: legacy.error.message || "Could not verify admin role." };
  }

  return { isAdmin: false, error: null };
}

async function findUserByIdentifier(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  identifier: string
): Promise<{ user: AdminUserRow | null; error: string | null }> {
  const selects = [
    "id,email,username,password,password_hash",
    "id,email,username,password_hash",
    "id,email,username,password",
    "id,email,password_hash",
    "id,email,password",
  ] as const;

  let lastError = "";
  for (const fields of selects) {
    const byEmail = await supabase
      .from("users")
      .select(fields)
      .ilike("email", identifier)
      .order("id", { ascending: true })
      .limit(1);

    if (!byEmail.error) {
      if (Array.isArray(byEmail.data) && byEmail.data.length > 0) {
        return { user: normalizeAdminUserRow(byEmail.data[0] as unknown as Record<string, unknown>), error: null };
      }

      const byUsername = await supabase
        .from("users")
        .select(fields)
        .ilike("username", identifier)
        .order("id", { ascending: true })
        .limit(1);
      if (!byUsername.error) {
        const row = Array.isArray(byUsername.data) && byUsername.data.length > 0 ? byUsername.data[0] : null;
        return { user: row ? normalizeAdminUserRow(row as unknown as Record<string, unknown>) : null, error: null };
      }
      if (!isMissingColumnError(byUsername.error)) {
        return { user: null, error: byUsername.error.message || "Could not validate admin login." };
      }
      lastError = byUsername.error.message || "Could not validate admin login.";
      continue;
    }

    if (!isMissingColumnError(byEmail.error)) {
      return { user: null, error: byEmail.error.message || "Could not validate admin login." };
    }
    lastError = byEmail.error.message || "Could not validate admin login.";
  }

  return { user: null, error: lastError };
}

function blockedAdminAccountMessage(status: string | null): string {
  if (status === "inactive") {
    return "This admin account is inactive. Contact a super admin to reactivate access.";
  }
  if (status === "suspended") {
    return "This admin account is suspended. Contact a super admin for assistance.";
  }
  if (status === "deleted") {
    return "This admin account has been deleted and cannot sign in.";
  }
  return "This admin account is not allowed to sign in.";
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

  const savedPassword = String(lookup.user.password ?? lookup.user.password_hash ?? "");
  if (!(await verifyPassword(password, savedPassword))) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  const accountState = await isUserAccountActive(supabase, lookup.user.id);
  if (accountState.error) {
    return NextResponse.json({ error: accountState.error }, { status: 400 });
  }
  if (!accountState.active) {
    return NextResponse.json({ error: blockedAdminAccountMessage(accountState.status) }, { status: 403 });
  }

  const roleCheck = await resolveProfileRole(supabase, lookup.user.id, { missingProfiles: "treatAsNoRole" });
  if (roleCheck.error) {
    return NextResponse.json({ error: roleCheck.error }, { status: 400 });
  }
  const mappedRoleCheck = await hasAdminRoleAssigned(supabase, lookup.user.id);
  if (mappedRoleCheck.error) {
    return NextResponse.json({ error: mappedRoleCheck.error }, { status: 400 });
  }
  if (!isAdminRole(roleCheck.role) && !mappedRoleCheck.isAdmin) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }

  const lastLoginUpdate = await updateUserLastLoginAt(supabase, lookup.user.id);
  if (lastLoginUpdate.error) {
    return NextResponse.json({ error: lastLoginUpdate.error }, { status: 400 });
  }

  const adminToken = await createAdminSessionToken(sessionSecret, String(lookup.user.id));
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, adminToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
