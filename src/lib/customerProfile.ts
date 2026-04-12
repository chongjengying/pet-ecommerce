import type { CustomerJwtPayload } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  fetchUserAddresses,
  type UserAddressRow,
} from "@/lib/userAddressDb";
import { userIdForDbQuery } from "@/lib/userIdDb";

const USER_FIELDS = "id, email, username, full_name, role";
const USER_FIELDS_NO_ROLE = "id, email, username, full_name";
const PROFILE_FIELDS = "id, user_id, username, full_name, avatar_url, phone, gender, dob";

export type ProfileUser = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  addresses: UserAddressRow[];
};

export type ResolvedUser = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string | null;
};

type UsersQueryResult = { data: unknown; error: { message?: string } | null };

type CustomerProfileLoadResult =
  | {
      error: null;
      status: 200;
      user: ProfileUser;
    }
  | {
      error: string;
      status: number;
      user: null;
    };

export function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function isMissingProfilesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("profiles") && (message.includes("does not exist") || message.includes("could not find"));
}

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

export async function selectUsersWithRoleFallback(
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

export async function resolveSessionUser(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  session: Pick<CustomerJwtPayload, "sub" | "username" | "email">
): Promise<ResolvedUser | null> {
  const sub = session.sub.trim();
  const username = session.username.trim();
  const email = session.email.trim().toLowerCase();

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

  if (username) {
    const byUsernameExact = await selectUsersWithRoleFallback(supabase, (fields) =>
      supabase.from("users").select(fields).eq("username", username).maybeSingle()
    );
    if (byUsernameExact.rows.length > 0) {
      return byUsernameExact.rows[0];
    }

    const byUsernameInsensitive = await selectUsersWithRoleFallback(supabase, (fields) =>
      supabase.from("users").select(fields).ilike("username", username).order("id", { ascending: true }).limit(1)
    );
    if (byUsernameInsensitive.rows.length > 0) {
      return byUsernameInsensitive.rows[0];
    }
  }

  if (email) {
    const byEmailExact = await selectUsersWithRoleFallback(supabase, (fields) =>
      supabase.from("users").select(fields).eq("email", email).maybeSingle()
    );
    if (byEmailExact.rows.length > 0) {
      return byEmailExact.rows[0];
    }

    const byEmailInsensitive = await selectUsersWithRoleFallback(supabase, (fields) =>
      supabase.from("users").select(fields).ilike("email", email).order("id", { ascending: true }).limit(1)
    );
    if (byEmailInsensitive.rows.length > 0) {
      return byEmailInsensitive.rows[0];
    }
  }

  if (username) {
    const profileMatch = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("username", username)
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
  }

  return null;
}

function buildUserResponse(
  data: ResolvedUser,
  profileData: Record<string, unknown> | null | undefined,
  addresses: UserAddressRow[]
): ProfileUser {
  return {
    ...data,
    username: data.username,
    full_name: data.full_name ?? null,
    avatar_url: (profileData?.avatar_url as string | null | undefined) ?? null,
    phone: (profileData?.phone as string | null | undefined) ?? null,
    gender: (profileData?.gender as string | null | undefined) ?? null,
    dob: (profileData?.dob as string | null | undefined) ?? null,
    addresses,
  };
}

export async function loadCustomerProfileForSession(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  session: Pick<CustomerJwtPayload, "sub" | "username" | "email">
): Promise<CustomerProfileLoadResult> {
  const data = await resolveSessionUser(supabase, session);

  if (!data) {
    return { error: "Profile not found.", status: 404, user: null };
  }

  const uid = userIdForDbQuery(data.id);

  const [{ data: profileData, error: profileError }, addresses] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("user_id", uid)
      .maybeSingle(),
    fetchUserAddresses(supabase, data.id),
  ]);

  if (profileError && !isMissingProfilesTable(profileError)) {
    return { error: profileError.message || "Could not load profile details.", status: 400, user: null };
  }

  if (profileError && isMissingProfilesTable(profileError)) {
    return {
      error: null,
      status: 200,
      user: {
        ...data,
        avatar_url: null,
        phone: null,
        gender: null,
        dob: null,
        addresses,
      },
    };
  }

  if (!profileData) {
    const { data: backfilledProfile, error: backfillError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: uid,
          username: data.username,
          full_name: data.full_name ?? null,
        },
        { onConflict: "user_id" }
      )
      .select(PROFILE_FIELDS)
      .maybeSingle();
    if (backfillError && !isMissingProfilesTable(backfillError)) {
      return { error: backfillError.message || "Could not load profile details.", status: 400, user: null };
    }
    return {
      error: null,
      status: 200,
      user: buildUserResponse(data, backfilledProfile ?? undefined, addresses),
    };
  }

  return {
    error: null,
    status: 200,
    user: buildUserResponse(data, profileData ?? undefined, addresses),
  };
}
