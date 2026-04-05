import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionSecret,
  verifyAdminSessionToken,
} from "@/lib/adminSession";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { isAdminRole, resolveProfileRole } from "@/lib/userRole";

export type AdminAccessDenied = { ok: false; status: 401 | 403 | 503; error: string };
export type AdminAccessOk = { ok: true; userId: string };
export type AdminAccessResult = AdminAccessOk | AdminAccessDenied;

/**
 * Validates admin_session cookie, rejects legacy tokens, and checks profiles.role === admin.
 * Use in admin API routes and server layouts.
 */
export async function verifyAdminAccess(): Promise<AdminAccessResult> {
  const secret = getAdminSessionSecret();
  if (!secret) {
    return { ok: false, status: 503, error: "Admin auth not configured." };
  }

  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  const verified = await verifyAdminSessionToken(token, secret);
  if (!verified.ok) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  if ("legacy" in verified && verified.legacy) {
    return {
      ok: false,
      status: 401,
      error: "Please sign in again with an admin account.",
    };
  }
  if (!("userId" in verified) || !verified.userId) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  const { userId } = verified;

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return {
      ok: false,
      status: 503,
      error: err instanceof Error ? err.message : "Server not configured.",
    };
  }

  const roleCheck = await resolveProfileRole(supabase, userId, { missingProfiles: "error" });
  if (roleCheck.error) {
    return { ok: false, status: 503, error: roleCheck.error };
  }
  if (!isAdminRole(roleCheck.role)) {
    return { ok: false, status: 403, error: "Admin access required." };
  }

  return { ok: true, userId };
}

export function adminAccessDeniedResponse(denied: AdminAccessDenied) {
  return NextResponse.json({ error: denied.error }, { status: denied.status });
}
