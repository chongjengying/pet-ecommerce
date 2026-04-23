import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { readEmailVerificationStatus } from "@/lib/emailVerification";
import { userIdForDbQuery } from "@/lib/userIdDb";

type AuthMeUser = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  isEmailVerified: boolean;
};

type AuthMeCacheEntry = {
  expiresAt: number;
  user: AuthMeUser;
};

const AUTH_ME_CACHE_TTL_MS = Math.max(1_000, Number(process.env.AUTH_ME_CACHE_TTL_MS ?? 30_000));
const authMeCache = new Map<string, AuthMeCacheEntry>();

function buildFallbackUser(customer: NonNullable<Awaited<ReturnType<typeof getCustomerFromRequest>>>): AuthMeUser {
  return {
    id: customer.sub,
    email: customer.email,
    username: customer.username,
    full_name: customer.fullName,
    role: customer.role,
    isEmailVerified: true,
  };
}

function toCacheHeaders(cache: "HIT" | "MISS"): HeadersInit {
  return {
    "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
    "X-Auth-Me-Cache": cache,
  };
}

async function loadUserFast(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string
): Promise<{ id: string; email: string; username: string; role: string; full_name: string | null } | null> {
  const idKey = userIdForDbQuery(userId);
  const attempts = [
    "id,email,username,first_name,last_name,full_name,role",
    "id,email,username,first_name,last_name,full_name",
    "id,email,username,full_name,role",
    "id,email,username,full_name",
  ] as const;

  for (const select of attempts) {
    const { data, error } = await supabase.from("users").select(select).eq("id", idKey).maybeSingle();
    if (error) {
      const msg = String(error.message ?? "").toLowerCase();
      if (msg.includes("column") && (msg.includes("does not exist") || msg.includes("could not find"))) {
        continue;
      }
      return null;
    }
    if (!data) return null;
    const row = data as Record<string, unknown>;
    const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
    const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
    const full = typeof row.full_name === "string" ? row.full_name.trim() : "";
    const mergedFull = [first, last].filter(Boolean).join(" ").trim() || full || null;
    return {
      id: String(row.id ?? userId),
      email: String(row.email ?? ""),
      username: String(row.username ?? ""),
      role: String(row.role ?? "customer"),
      full_name: mergedFull,
    };
  }

  return null;
}

export async function GET(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const cacheKey = `${customer.sub}:${customer.iat}:${customer.exp}:${customer.username}`;
  const now = Date.now();
  const cached = authMeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ user: cached.user }, { headers: toCacheHeaders("HIT") });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    const fallbackUser = buildFallbackUser(customer);
    authMeCache.set(cacheKey, { user: fallbackUser, expiresAt: now + AUTH_ME_CACHE_TTL_MS });
    return NextResponse.json({ user: fallbackUser }, { headers: toCacheHeaders("MISS") });
  }

  const fastUser = await loadUserFast(supabase, customer.sub);
  const verification = fastUser ? await readEmailVerificationStatus(supabase, fastUser.id) : null;
  const isEmailVerified = verification?.isEmailVerified ?? true;
  const liveEmail = String(fastUser?.email ?? customer.email ?? "").trim();
  const liveFullName =
    fastUser?.full_name ??
    customer.fullName ??
    null;
  const liveRole = fastUser?.role ?? customer.role;
  const user: AuthMeUser = {
    id: String(fastUser?.id ?? customer.sub),
    email: liveEmail,
    username: String(fastUser?.username ?? customer.username),
    full_name: liveFullName,
    role: liveRole,
    isEmailVerified,
  };
  authMeCache.set(cacheKey, { user, expiresAt: now + AUTH_ME_CACHE_TTL_MS });
  return NextResponse.json({ user }, { headers: toCacheHeaders("MISS") });
}
