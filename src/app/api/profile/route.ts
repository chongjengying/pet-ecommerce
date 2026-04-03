import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const USER_FIELDS = "id, email, username, full_name, role";
const USER_FIELDS_NO_ROLE = "id, email, username, full_name";
const PROFILE_FIELDS = "user_id, username, full_name, avatar_url, phone, gender, dob";

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isMissingProfilesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("profiles") && (message.includes("does not exist") || message.includes("could not find"));
}

type ResolvedUser = {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: string | null;
};

function normalizeResolvedUser(row: Record<string, unknown>): ResolvedUser {
  return {
    id: Number(row.id),
    email: String(row.email ?? ""),
    username: String(row.username ?? ""),
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    role: typeof row.role === "string" ? row.role : "customer",
  };
}

function isMissingRoleColumnError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("role") && message.includes("column");
}

async function selectUsersWithRoleFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  fetcher: (fields: string) => Promise<{ data: unknown; error: { message?: string } | null }>
): Promise<{ rows: ResolvedUser[]; error: string | null }> {
  const withRole = await fetcher(USER_FIELDS);
  if (!withRole.error) {
    return {
      rows: Array.isArray(withRole.data)
        ? (withRole.data as Record<string, unknown>[]).map(normalizeResolvedUser)
        : withRole.data
          ? [normalizeResolvedUser(withRole.data as Record<string, unknown>)]
          : [],
      error: null,
    };
  }
  if (!isMissingRoleColumnError(withRole.error)) {
    return { rows: [], error: withRole.error.message || "Could not load user profile." };
  }

  const withoutRole = await fetcher(USER_FIELDS_NO_ROLE);
  if (withoutRole.error) {
    return { rows: [], error: withoutRole.error.message || "Could not load user profile." };
  }
  return {
    rows: Array.isArray(withoutRole.data)
      ? (withoutRole.data as Record<string, unknown>[]).map(normalizeResolvedUser)
      : withoutRole.data
        ? [normalizeResolvedUser(withoutRole.data as Record<string, unknown>)]
        : [],
    error: null,
  };
}

async function resolveSessionUser(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  session: { sub: string; username: string; email: string }
): Promise<ResolvedUser | null> {
  const sessionUserId = Number(session.sub);
  const byIdResult = Number.isFinite(sessionUserId)
    ? await selectUsersWithRoleFallback(supabase, (fields) =>
        supabase.from("users").select(fields).eq("id", sessionUserId).maybeSingle()
      )
    : { rows: [], error: null };
  if (byIdResult.rows.length > 0) {
    return byIdResult.rows[0];
  }

  const byUsernameResult = await selectUsersWithRoleFallback(supabase, (fields) =>
    supabase.from("users").select(fields).ilike("username", session.username).order("id", { ascending: true }).limit(1)
  );
  if (byUsernameResult.rows.length > 0) {
    return byUsernameResult.rows[0];
  }

  const byEmailResult = await selectUsersWithRoleFallback(supabase, (fields) =>
    supabase.from("users").select(fields).ilike("email", session.email).order("id", { ascending: true }).limit(1)
  );
  if (byEmailResult.rows.length > 0) {
    return byEmailResult.rows[0];
  }

  // Legacy fallback: username may only exist in profiles table.
  const profileMatch = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("username", session.username)
    .order("user_id", { ascending: true })
    .limit(1);
  if (profileMatch.error && !isMissingProfilesTable(profileMatch.error)) {
    return null;
  }
  const matchedUserId =
    Array.isArray(profileMatch.data) && profileMatch.data.length > 0
      ? profileMatch.data[0]?.user_id
      : null;
  if (matchedUserId != null) {
    const byProfileResult = await selectUsersWithRoleFallback(supabase, (fields) =>
      supabase.from("users").select(fields).eq("id", matchedUserId).maybeSingle()
    );
    if (byProfileResult.rows.length > 0) {
      return byProfileResult.rows[0];
    }
  }

  return null;
}

export async function GET(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Profile API not configured." },
      { status: 503 }
    );
  }

  const data = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });

  if (!data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("user_id", data.id)
    .maybeSingle();

  if (profileError && !isMissingProfilesTable(profileError)) {
    return NextResponse.json({ error: profileError.message || "Could not load profile details." }, { status: 400 });
  }

  if (profileError && isMissingProfilesTable(profileError)) {
    return NextResponse.json({
      user: {
        ...data,
        avatar_url: null,
        phone: null,
        gender: null,
        dob: null,
      },
    });
  }

  if (!profileData) {
    // Backfill profile identity fields for older users who predate profiles rows.
    const { error: backfillError } = await supabase.from("profiles").upsert(
      {
        user_id: Number(data.id),
        username: data.username,
        full_name: data.full_name ?? null,
      },
      { onConflict: "user_id" }
    );
    if (backfillError && !isMissingProfilesTable(backfillError)) {
      return NextResponse.json({ error: backfillError.message || "Could not load profile details." }, { status: 400 });
    }
  }

  return NextResponse.json({
    user: {
      ...data,
      username: profileData?.username ?? data.username,
      full_name: profileData?.full_name ?? data.full_name ?? null,
      avatar_url: profileData?.avatar_url ?? null,
      phone: profileData?.phone ?? null,
      gender: profileData?.gender ?? null,
      dob: profileData?.dob ?? null,
    },
  });
}

export async function PUT(request: Request) {
  const session = await getCustomerFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Profile API not configured." },
      { status: 503 }
    );
  }

  const resolvedUser = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!resolvedUser) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  const userId = Number(resolvedUser.id);

  let body: {
    full_name?: unknown;
    avatar_url?: unknown;
    phone?: unknown;
    gender?: unknown;
    dob?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const has = (key: keyof typeof body) => Object.prototype.hasOwnProperty.call(body, key);
  const userUpdatePayload: Record<string, unknown> = {};
  const profileUpdatePayload: Record<string, unknown> = {};

  if (has("full_name")) {
    userUpdatePayload.full_name = cleanString(body.full_name);
    profileUpdatePayload.full_name = cleanString(body.full_name);
  }
  if (has("avatar_url")) {
    profileUpdatePayload.avatar_url = cleanString(body.avatar_url);
  }
  if (has("phone")) {
    profileUpdatePayload.phone = cleanString(body.phone);
  }
  if (has("gender")) {
    profileUpdatePayload.gender = cleanString(body.gender);
  }
  if (has("dob")) {
    profileUpdatePayload.dob = typeof body.dob === "string" && body.dob.trim() ? body.dob.trim() : null;
  }

  if (Object.keys(userUpdatePayload).length === 0 && Object.keys(profileUpdatePayload).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  if (Object.keys(userUpdatePayload).length > 0) {
    const { error: userError } = await supabase.from("users").update(userUpdatePayload).eq("id", userId);
    if (userError) {
      return NextResponse.json({ error: userError.message || "Could not update user profile." }, { status: 400 });
    }
  }

  if (Object.keys(profileUpdatePayload).length > 0) {
    let profilesTableMissing = false;
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        username: session.username,
        ...profileUpdatePayload,
      },
      { onConflict: "user_id" }
    );
    if (profileError) {
      if (isMissingProfilesTable(profileError)) {
        // Allow updating core user fields even before profiles table migration is applied.
        profilesTableMissing = true;
      } else {
        return NextResponse.json({ error: profileError.message || "Could not update profile details." }, { status: 400 });
      }
    }
    if (profilesTableMissing) {
      // No-op by design: continue and return users data with null profile fields.
    }
  }

  const refreshedUser = await resolveSessionUser(supabase, {
    sub: String(userId),
    username: session.username,
    email: session.email,
  });
  if (!refreshedUser) {
    return NextResponse.json({ error: "Profile not found after update." }, { status: 404 });
  }

  const { data: profileData, error: profileReadError } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();

  const missingProfiles = profileReadError && isMissingProfilesTable(profileReadError);

  return NextResponse.json({
    user: {
      ...refreshedUser,
      username: profileData?.username ?? refreshedUser.username,
      full_name: profileData?.full_name ?? refreshedUser.full_name ?? null,
      avatar_url: missingProfiles ? null : profileData?.avatar_url ?? null,
      phone: missingProfiles ? null : profileData?.phone ?? null,
      gender: missingProfiles ? null : profileData?.gender ?? null,
      dob: missingProfiles ? null : profileData?.dob ?? null,
    },
  });
}
