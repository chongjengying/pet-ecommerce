import type { CustomerJwtPayload } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  fetchUserAddresses,
  type UserAddressRow,
} from "@/lib/userAddressDb";
import { userIdForDbQuery } from "@/lib/userIdDb";

const USER_SELECT_ATTEMPTS = [
  "id, email, username, first_name, last_name, role",
  "id, email, username, first_name, last_name",
  "id, email, username, first_name, last_name, full_name, role",
  "id, email, username, full_name, role",
  "id, email, username, first_name, last_name, full_name",
  "id, email, username, full_name",
] as const;

export const PROFILE_SELECT_ATTEMPTS = [
  "id, user_id, username, first_name, last_name, full_name, avatar_url, phone, gender, dob",
  "id, user_id, username, first_name, last_name, avatar_url, phone, gender, dob",
  "id, user_id, username, full_name, avatar_url, phone, gender, dob",
] as const;

export type ProfileUser = {
  id: string;
  email: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
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
  first_name: string | null;
  last_name: string | null;
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

function isMissingColumnError(error: unknown, column?: string): boolean {
  const code = String((error as { code?: string })?.code ?? "").toLowerCase();
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  if (code === "42703" || code === "pgrst204") {
    return column ? message.includes(column.toLowerCase()) : true;
  }
  return (
    message.includes("column") &&
    (message.includes("does not exist") || message.includes("could not find")) &&
    (column ? message.includes(column.toLowerCase()) : true)
  );
}

function parseMissingColumn(error: unknown): string | null {
  const message = String((error as { message?: string })?.message ?? "");
  return (
    message.match(/Could not find the '([^']+)' column/i)?.[1] ??
    message.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i)?.[1] ??
    null
  );
}

function logMissingColumn(context: string, error: unknown, details: Record<string, unknown>) {
  console.warn(`[schema-fallback] ${context}`, {
    code: String((error as { code?: string })?.code ?? "") || null,
    missingColumn: parseMissingColumn(error),
    message: String((error as { message?: string })?.message ?? "Unknown profile schema error."),
    ...details,
  });
}

function composeFullName(firstName: string | null, lastName: string | null, fullName: string | null): string | null {
  const combined = [firstName, lastName].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ").trim();
  return combined || fullName || null;
}

function normalizeResolvedUser(row: Record<string, unknown>): ResolvedUser {
  const firstName = typeof row.first_name === "string" ? row.first_name : null;
  const lastName = typeof row.last_name === "string" ? row.last_name : null;
  const fullName = typeof row.full_name === "string" ? row.full_name : null;
  return {
    id: row.id != null ? String(row.id) : "",
    email: String(row.email ?? ""),
    username: String(row.username ?? ""),
    first_name: firstName,
    last_name: lastName,
    full_name: composeFullName(firstName, lastName, fullName),
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
  let lastError: string | null = null;
  for (const fields of USER_SELECT_ATTEMPTS) {
    const result = await fetcher(fields);
    if (!result.error) {
      return {
        rows: Array.isArray(result.data)
          ? (result.data as Record<string, unknown>[]).map(normalizeResolvedUser)
          : result.data
            ? [normalizeResolvedUser(result.data as Record<string, unknown>)]
            : [],
        error: null,
      };
    }

    lastError = result.error.message || "Could not load user profile.";
    if (
      !isMissingRoleColumnError(result.error) &&
      !isMissingColumnError(result.error, "full_name") &&
      !isMissingColumnError(result.error, "first_name") &&
      !isMissingColumnError(result.error, "last_name")
    ) {
      return { rows: [], error: lastError };
    }
    logMissingColumn("users.select", result.error, {
      table: "users",
      fields,
    });
  }
  return { rows: [], error: lastError };
}

export async function selectProfileWithFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string | number
): Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }> {
  let lastError: { message?: string } | null = null;
  for (const fields of PROFILE_SELECT_ATTEMPTS) {
    const result = await supabase.from("profiles").select(fields).eq("user_id", userId).maybeSingle();
    if (!result.error) {
      return { data: (result.data as Record<string, unknown> | null) ?? null, error: null };
    }
    lastError = result.error;
    if (
      !isMissingColumnError(result.error, "full_name") &&
      !isMissingColumnError(result.error, "first_name") &&
      !isMissingColumnError(result.error, "last_name")
    ) {
      return { data: null, error: result.error };
    }
    logMissingColumn("profiles.select", result.error, {
      table: "profiles",
      fields,
      userId: String(userId),
    });
  }
  return { data: null, error: lastError };
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
  const profileFirstName = (profileData?.first_name as string | null | undefined) ?? data.first_name ?? null;
  const profileLastName = (profileData?.last_name as string | null | undefined) ?? data.last_name ?? null;
  const profileFullName = composeFullName(
    profileFirstName,
    profileLastName,
    (profileData?.full_name as string | null | undefined) ?? data.full_name ?? null
  );
  return {
    ...data,
    username: data.username,
    first_name: profileFirstName,
    last_name: profileLastName,
    full_name: profileFullName,
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
    selectProfileWithFallback(supabase, uid),
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
          first_name: data.first_name ?? null,
          last_name: data.last_name ?? null,
          full_name: data.full_name ?? null,
        },
        { onConflict: "user_id" }
      )
      .select(PROFILE_SELECT_ATTEMPTS[0])
      .maybeSingle();
    const normalizedBackfilledProfile =
      backfillError && (isMissingColumnError(backfillError, "first_name") || isMissingColumnError(backfillError, "last_name"))
        ? await selectProfileWithFallback(supabase, uid)
        : { data: backfilledProfile as Record<string, unknown> | null, error: backfillError };
    if (backfillError && isMissingColumnError(backfillError)) {
      logMissingColumn("profiles.upsert", backfillError, {
        table: "profiles",
        userId: String(uid),
        attemptedColumns: ["username", "first_name", "last_name", "full_name"],
      });
    }
    if (normalizedBackfilledProfile.error && !isMissingProfilesTable(normalizedBackfilledProfile.error)) {
      return { error: normalizedBackfilledProfile.error.message || "Could not load profile details.", status: 400, user: null };
    }
    return {
      error: null,
      status: 200,
      user: buildUserResponse(data, normalizedBackfilledProfile.data ?? undefined, addresses),
    };
  }

  return {
    error: null,
    status: 200,
    user: buildUserResponse(data, profileData ?? undefined, addresses),
  };
}
