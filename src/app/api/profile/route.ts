import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  fetchUserAddresses,
  isMissingUserAddressesTable,
  upsertDefaultUserAddress,
  type UserAddressRow,
} from "@/lib/userAddressDb";
import { userIdForDbQuery } from "@/lib/userIdDb";

const USER_FIELDS = "id, email, username, full_name, role";
const USER_FIELDS_NO_ROLE = "id, email, username, full_name";
const PROFILE_FIELDS = "id, user_id, username, full_name, avatar_url, phone, gender, dob";
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
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string | null;
};

function normalizeResolvedUser(row: Record<string, unknown>): ResolvedUser {
  return {
    id: row.id != null ? String(row.id) : "",
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

type UsersQueryResult = { data: unknown; error: { message?: string } | null };

async function selectUsersWithRoleFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  fetcher: (fields: string) => PromiseLike<UsersQueryResult>
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
  const sub = session.sub.trim();

  const bySub = await selectUsersWithRoleFallback(supabase, (fields) =>
    supabase.from("users").select(fields).eq("id", sub).maybeSingle()
  );
  if (bySub.rows.length > 0) {
    return bySub.rows[0];
  }

  const sessionUserIdNum = Number(sub);
  if (Number.isFinite(sessionUserIdNum) && /^[0-9]+$/.test(sub)) {
    const byIdResult = await selectUsersWithRoleFallback(supabase, (fields) =>
      supabase.from("users").select(fields).eq("id", sessionUserIdNum).maybeSingle()
    );
    if (byIdResult.rows.length > 0) {
      return byIdResult.rows[0];
    }
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
    const uid = userIdForDbQuery(matchedUserId as string | number);
    const byProfileResult = await selectUsersWithRoleFallback(supabase, (fields) =>
      supabase.from("users").select(fields).eq("id", uid).maybeSingle()
    );
    if (byProfileResult.rows.length > 0) {
      return byProfileResult.rows[0];
    }
  }

  return null;
}

function buildUserResponse(
  data: ResolvedUser,
  profileData: Record<string, unknown> | null | undefined,
  addresses: UserAddressRow[]
) {
  return {
    user: {
      ...data,
      username: data.username,
      full_name: data.full_name ?? null,
      avatar_url: (profileData?.avatar_url as string | null | undefined) ?? null,
      phone: (profileData?.phone as string | null | undefined) ?? null,
      gender: (profileData?.gender as string | null | undefined) ?? null,
      dob: (profileData?.dob as string | null | undefined) ?? null,
      addresses,
    },
  };
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

  const uid = userIdForDbQuery(data.id);

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("user_id", uid)
    .maybeSingle();

  if (profileError && !isMissingProfilesTable(profileError)) {
    return NextResponse.json({ error: profileError.message || "Could not load profile details." }, { status: 400 });
  }

  const addresses = await fetchUserAddresses(supabase, data.id);

  if (profileError && isMissingProfilesTable(profileError)) {
    return NextResponse.json({
      user: {
        ...data,
        avatar_url: null,
        phone: null,
        gender: null,
        dob: null,
        addresses,
      },
    });
  }

  if (!profileData) {
    const { error: backfillError } = await supabase.from("profiles").upsert(
      {
        user_id: uid,
        username: data.username,
        full_name: data.full_name ?? null,
      },
      { onConflict: "user_id" }
    );
    if (backfillError && !isMissingProfilesTable(backfillError)) {
      return NextResponse.json({ error: backfillError.message || "Could not load profile details." }, { status: 400 });
    }
  }

  const { data: refreshedProfile } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("user_id", uid)
    .maybeSingle();

  return NextResponse.json(
    buildUserResponse(data, refreshedProfile ?? profileData ?? undefined, addresses)
  );
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

  const userIdKey = userIdForDbQuery(resolvedUser.id);

  let body: {
    full_name?: unknown;
    avatar_url?: unknown;
    phone?: unknown;
    gender?: unknown;
    dob?: unknown;
    address_label?: unknown;
    address_line1?: unknown;
    address_line2?: unknown;
    address_city?: unknown;
    address_state?: unknown;
    address_postal_code?: unknown;
    address_country?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const has = (key: keyof typeof body) => Object.prototype.hasOwnProperty.call(body, key);
  const userUpdatePayload: Record<string, unknown> = {};
  const profileExtras: Record<string, unknown> = {};

  if (has("full_name")) {
    userUpdatePayload.full_name = cleanString(body.full_name);
  }
  if (has("avatar_url")) {
    profileExtras.avatar_url = cleanString(body.avatar_url);
  }
  if (has("phone")) {
    profileExtras.phone = cleanString(body.phone);
  }
  if (has("gender")) {
    profileExtras.gender = cleanString(body.gender);
  }
  if (has("dob")) {
    profileExtras.dob = typeof body.dob === "string" && body.dob.trim() ? body.dob.trim() : null;
  }

  const mirrorFullName = has("full_name") ? cleanString(body.full_name) : resolvedUser.full_name;

  const addrLine1 = cleanString(body.address_line1);
  const addrCity = cleanString(body.address_city);
  const addrState = cleanString(body.address_state);
  const addrPostal = cleanString(body.address_postal_code);
  const addrCountry = cleanString(body.address_country);
  const addressComplete = Boolean(addrLine1 && addrCity && addrState && addrPostal && addrCountry);
  if (!addressComplete) {
    return NextResponse.json(
      {
        error:
          "Shipping address is required: line 1, city, state or region, postal code, and country.",
      },
      { status: 400 }
    );
  }

  if (Object.keys(userUpdatePayload).length > 0) {
    const { error: userError } = await supabase.from("users").update(userUpdatePayload).eq("id", userIdKey);
    if (userError) {
      return NextResponse.json({ error: userError.message || "Could not update user profile." }, { status: 400 });
    }
  }

  let profilesTableMissing = false;
  const { error: profileUpsertError } = await supabase.from("profiles").upsert(
    {
      user_id: userIdKey,
      username: session.username,
      full_name: mirrorFullName,
      ...profileExtras,
    },
    { onConflict: "user_id" }
  );
  if (profileUpsertError) {
    if (isMissingProfilesTable(profileUpsertError)) {
      profilesTableMissing = true;
    } else {
      return NextResponse.json({ error: profileUpsertError.message || "Could not update profile details." }, { status: 400 });
    }
  }

  if (profilesTableMissing) {
    return NextResponse.json(
      { error: "Profile storage is required to save your shipping address." },
      { status: 503 }
    );
  }

  const addrResult = await upsertDefaultUserAddress(supabase, resolvedUser.id, {
    label: cleanString(body.address_label) ?? "Home",
    line1: addrLine1!,
    line2: cleanString(body.address_line2),
    city: addrCity!,
    state: addrState!,
    postal_code: addrPostal!,
    country: addrCountry!,
  });
  if (addrResult.error && !isMissingUserAddressesTable(addrResult.error)) {
    return NextResponse.json(
      { error: addrResult.error.message || "Could not save address." },
      { status: 400 }
    );
  }

  const refreshedUser = await resolveSessionUser(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });
  if (!refreshedUser) {
    return NextResponse.json({ error: "Profile not found after update." }, { status: 404 });
  }

  const uid = userIdForDbQuery(refreshedUser.id);

  const { data: profileData, error: profileReadError } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("user_id", uid)
    .maybeSingle();

  const missingProfiles = profileReadError && isMissingProfilesTable(profileReadError);
  const addresses = await fetchUserAddresses(supabase, refreshedUser.id);

  return NextResponse.json({
    user: {
      ...refreshedUser,
      username: refreshedUser.username,
      full_name: refreshedUser.full_name ?? null,
      avatar_url: missingProfiles ? null : profileData?.avatar_url ?? null,
      phone: missingProfiles ? null : profileData?.phone ?? null,
      gender: missingProfiles ? null : profileData?.gender ?? null,
      dob: missingProfiles ? null : profileData?.dob ?? null,
      addresses,
    },
  });
}
