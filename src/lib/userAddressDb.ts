import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";

/**
 * Supabase table for shipping rows (linked to `users` and usually `profiles`).
 * Set `SUPABASE_ADDRESSES_TABLE=addresses` in `.env.local` if your table is not `user_addresses`.
 */
export function addressesTable(): string {
  return (
    process.env.SUPABASE_ADDRESSES_TABLE?.trim() ||
    process.env.SUPABASE_USER_ADDRESSES_TABLE?.trim() ||
    "user_addresses"
  );
}

export const USER_ADDRESS_SELECT_FIELDS = "*";

export type UserAddressRow = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
};

export function getDefaultUserAddress(addresses: UserAddressRow[]): UserAddressRow | null {
  if (!addresses.length) return null;
  return addresses.find((a) => a.is_default) ?? addresses[0] ?? null;
}

const nonEmpty = (s: string | null | undefined): boolean => typeof s === "string" && s.trim().length > 0;

/** Line 1, city, state, postal code, and country must be filled for checkout and profile save. */
export function isCompleteShippingAddress(row: UserAddressRow | null | undefined): boolean {
  if (!row) return false;
  return (
    nonEmpty(row.line1) &&
    nonEmpty(row.city) &&
    nonEmpty(row.state) &&
    nonEmpty(row.postal_code) &&
    nonEmpty(row.country)
  );
}

type Supabase = ReturnType<typeof getSupabaseServerClient>;
type DbError = { message?: string } | null;
type AddressLiteRow = { id?: unknown; is_default?: boolean };

export function isMissingUserAddressesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  const table = addressesTable().toLowerCase();
  return (
    message.includes(table) &&
    (message.includes("does not exist") || message.includes("could not find"))
  );
}

function missingAddressesTableError(): { message: string } {
  const table = addressesTable();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "(missing NEXT_PUBLIC_SUPABASE_URL)";
  return {
    message: `Address table "${table}" was not found for project ${supabaseUrl}. Create it in schema public (recommended: user_addresses), reload PostgREST schema cache, or set SUPABASE_ADDRESSES_TABLE / SUPABASE_USER_ADDRESSES_TABLE to your existing table name.`,
  };
}

function isMissingColumn(error: unknown, column: string): boolean {
  const m = String((error as { message?: string })?.message ?? "").toLowerCase();
  const c = column.toLowerCase();
  return (
    m.includes(c) &&
    m.includes("column") &&
    (m.includes("could not find") || m.includes("does not exist"))
  );
}

export function mapUserAddressRow(r: Record<string, unknown>): UserAddressRow {
  const line1 =
    typeof r.line1 === "string"
      ? r.line1
      : typeof r.address_line1 === "string"
        ? r.address_line1
        : "";
  return {
    id: String(r.id ?? ""),
    label: typeof r.label === "string" ? r.label : "Home",
    line1,
    line2: typeof r.line2 === "string" ? r.line2 : null,
    city: typeof r.city === "string" ? r.city : "",
    state: typeof r.state === "string" ? r.state : null,
    postal_code: typeof r.postal_code === "string" ? r.postal_code : null,
    country: typeof r.country === "string" ? r.country : "MY",
    is_default: Boolean(r.is_default),
  };
}

async function selectAddressesByUserId(
  supabase: Supabase,
  uid: string | number
): Promise<{ data: unknown[] | null; error: DbError }> {
  const { data, error } = await supabase
    .from(addressesTable())
    .select(USER_ADDRESS_SELECT_FIELDS)
    .eq("user_id", uid)
    .order("created_at", { ascending: true });

  if (error) return { data: null, error };
  return { data: Array.isArray(data) ? data : [], error: null };
}

async function selectAddressesByProfileId(
  supabase: Supabase,
  profileId: string
): Promise<{ data: unknown[] | null; error: DbError }> {
  const { data, error } = await supabase
    .from(addressesTable())
    .select(USER_ADDRESS_SELECT_FIELDS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  if (error) return { data: null, error };
  return { data: Array.isArray(data) ? data : [], error: null };
}

export async function fetchUserAddresses(supabase: Supabase, userId: string): Promise<UserAddressRow[]> {
  const uid = userIdForDbQuery(userId);
  const byUser = await selectAddressesByUserId(supabase, uid);
  if (!byUser.error) {
    const rows = byUser.data ?? [];
    if (rows.length > 0) {
      return rows.map((row) => mapUserAddressRow(row as Record<string, unknown>));
    }
    return [];
  }
  if (isMissingUserAddressesTable(byUser.error)) return [];
  if (!isMissingColumn(byUser.error, "user_id")) return [];

  const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", uid).maybeSingle();
  const profileId = prof?.id != null ? String(prof.id) : null;
  if (!profileId) return [];

  const byProfile = await selectAddressesByProfileId(supabase, profileId);
  if (byProfile.error) {
    if (isMissingUserAddressesTable(byProfile.error)) return [];
    return [];
  }
  const rows = byProfile.data ?? [];
  return rows.map((row) => mapUserAddressRow(row as Record<string, unknown>));
}

export type DefaultUserAddressPayload = {
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
};

function missingColumnName(error: unknown): string | null {
  const msg = String((error as { message?: string })?.message ?? "");
  const m1 = msg.match(/column ["']?([a-zA-Z0-9_]+)["']?/i);
  if (m1?.[1]) return m1[1];
  const m2 = msg.match(/could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i);
  if (m2?.[1]) return m2[1];
  return null;
}

async function insertWithMissingColumnFallback(
  supabase: Supabase,
  row: Record<string, unknown>
): Promise<DbError> {
  const payload: Record<string, unknown> = { ...row };
  for (let i = 0; i < 12; i += 1) {
    const { error } = await supabase.from(addressesTable()).insert(payload);
    if (!error) return null;
    const missing = missingColumnName(error);
    if (!missing || !(missing in payload)) return error;
    delete payload[missing];
  }
  return { message: "Could not insert address due to repeated schema mismatch." };
}

async function updateByIdWithMissingColumnFallback(
  supabase: Supabase,
  id: string,
  row: Record<string, unknown>
): Promise<DbError> {
  const payload: Record<string, unknown> = { ...row };
  for (let i = 0; i < 12; i += 1) {
    const { error } = await supabase.from(addressesTable()).update(payload).eq("id", id);
    if (!error) return null;
    const missing = missingColumnName(error);
    if (!missing || !(missing in payload)) return error;
    delete payload[missing];
  }
  return { message: "Could not update address due to repeated schema mismatch." };
}

function asLiteRows(data: unknown): AddressLiteRow[] {
  return Array.isArray(data) ? (data as AddressLiteRow[]) : [];
}

async function selectAddressRowsForUpsert(
  supabase: Supabase,
  key: "user_id" | "profile_id",
  value: string | number
): Promise<{ rows: AddressLiteRow[]; error: DbError }> {
  const withDefault = await supabase.from(addressesTable()).select("id,is_default").eq(key, value);
  if (!withDefault.error) {
    return { rows: asLiteRows(withDefault.data), error: null };
  }
  if (!isMissingColumn(withDefault.error, "is_default")) {
    return { rows: [], error: withDefault.error };
  }
  const noDefault = await supabase.from(addressesTable()).select("id").eq(key, value);
  if (noDefault.error) return { rows: [], error: noDefault.error };
  return { rows: asLiteRows(noDefault.data), error: null };
}

async function upsertDefaultByUserIdOnly(
  supabase: Supabase,
  uid: string | number,
  payload: DefaultUserAddressPayload
): Promise<{ error: { message?: string } | null }> {
  const { rows: existingRows, error: listError } = await selectAddressRowsForUpsert(supabase, "user_id", uid);

  if (listError) {
    if (isMissingUserAddressesTable(listError)) return { error: missingAddressesTableError() };
    return { error: listError };
  }

  const rows = Array.isArray(existingRows) ? existingRows : [];
  const defaultRow = rows.find((r: { is_default?: boolean }) => r.is_default) ?? rows[0];
  const rawId = defaultRow != null ? (defaultRow as { id?: unknown }).id : null;
  const id = rawId != null && String(rawId).length > 0 ? String(rawId) : null;

  if (id) {
    const { error: u1 } = await supabase
      .from(addressesTable())
      .update({ is_default: false })
      .eq("user_id", uid)
      .neq("id", id);
    if (u1 && !isMissingColumn(u1, "is_default")) return { error: u1 };

    const u2 = await updateByIdWithMissingColumnFallback(supabase, id, {
      ...payload,
      address_line1: payload.line1,
      is_default: true,
    });
    return { error: u2 };
  }

  const ins = await insertWithMissingColumnFallback(supabase, {
    user_id: uid,
    ...payload,
    address_line1: payload.line1,
    is_default: true,
  });
  return { error: ins };
}

export async function upsertDefaultUserAddress(
  supabase: Supabase,
  userId: string | number,
  payload: DefaultUserAddressPayload
): Promise<{ error: { message?: string } | null }> {
  const uid = userIdForDbQuery(userId);

  const { data: prof, error: profErr } = await supabase.from("profiles").select("id").eq("user_id", uid).maybeSingle();
  if (profErr) {
    return { error: profErr };
  }
  const profileId = prof?.id != null ? String(prof.id) : null;
  if (!profileId) {
    return upsertDefaultByUserIdOnly(supabase, uid, payload);
  }

  // Best-effort linking: if legacy rows exist without profile_id, backfill them.
  const linkAttempt = await supabase
    .from(addressesTable())
    .update({ profile_id: profileId })
    .eq("user_id", uid)
    .is("profile_id", null);
  if (linkAttempt.error && !isMissingColumn(linkAttempt.error, "profile_id")) {
    if (isMissingUserAddressesTable(linkAttempt.error)) {
      return { error: missingAddressesTableError() };
    }
    return { error: linkAttempt.error };
  }

  const { rows: existingRows, error: listError } = await selectAddressRowsForUpsert(
    supabase,
    "profile_id",
    profileId
  );

  if (listError) {
    if (isMissingUserAddressesTable(listError)) {
      return { error: missingAddressesTableError() };
    }
    if (isMissingColumn(listError, "profile_id")) {
      return upsertDefaultByUserIdOnly(supabase, uid, payload);
    }
    return { error: listError };
  }

  const rows = Array.isArray(existingRows) ? existingRows : [];
  const defaultRow = rows.find((r: { is_default?: boolean }) => r.is_default) ?? rows[0];
  const rawId = defaultRow != null ? (defaultRow as { id?: unknown }).id : null;
  const id = rawId != null && String(rawId).length > 0 ? String(rawId) : null;

  if (id) {
    const { error: u1 } = await supabase
      .from(addressesTable())
      .update({ is_default: false })
      .eq("profile_id", profileId)
      .neq("id", id);
    if (u1) {
      if (isMissingColumn(u1, "is_default")) {
        // Legacy schemas may not have is_default; continue without resetting other rows.
      } else if (isMissingColumn(u1, "profile_id")) {
        return upsertDefaultByUserIdOnly(supabase, uid, payload);
      } else {
        return { error: u1 };
      }
    }

    const u2 = await updateByIdWithMissingColumnFallback(supabase, id, {
      ...payload,
      address_line1: payload.line1,
      is_default: true,
    });
    return { error: u2 };
  }

  const insertRow: Record<string, unknown> = {
    user_id: uid,
    profile_id: profileId,
    ...payload,
    address_line1: payload.line1,
    is_default: true,
  };
  const ins = await insertWithMissingColumnFallback(supabase, insertRow);
  if (ins && isMissingColumn(ins, "profile_id")) {
    delete insertRow.profile_id;
    const retry = await insertWithMissingColumnFallback(supabase, insertRow);
    return { error: retry };
  }
  return { error: ins };
}
