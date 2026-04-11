import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";

/**
 * Supabase table for shipping rows owned by `users`.
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
  recipient_name?: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
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
    nonEmpty(row.address_line1) &&
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

function logAddressQueryIssue(context: string, error: unknown): void {
  const message = String((error as { message?: string })?.message ?? "Unknown address query error");
  console.error(`[userAddressDb] ${context}: ${message}`);
}

export function mapUserAddressRow(r: Record<string, unknown>): UserAddressRow {
  const addressLine1 =
    typeof r.address_line1 === "string"
      ? r.address_line1
      : "";
  const addressLine2 =
    typeof r.address_line2 === "string"
      ? r.address_line2
      : null;
  return {
    id: String(r.id ?? ""),
    label: typeof r.label === "string" ? r.label : "Home",
    recipient_name: typeof r.recipient_name === "string" ? r.recipient_name : null,
    address_line1: addressLine1,
    address_line2: addressLine2,
    city: typeof r.city === "string" ? r.city : "",
    state: typeof r.state === "string" ? r.state : null,
    postal_code: typeof r.postal_code === "string" ? r.postal_code : null,
    country: typeof r.country === "string" ? r.country : "MY",
    is_default:
      typeof r.is_default === "boolean"
        ? r.is_default
        : typeof r.is_default_shipping === "boolean"
          ? r.is_default_shipping
          : false,
    is_default_shipping:
      typeof r.is_default_shipping === "boolean" ? r.is_default_shipping : Boolean(r.is_default),
    is_default_billing:
      typeof r.is_default_billing === "boolean" ? r.is_default_billing : Boolean(r.is_default),
  };
}

async function selectAddressesByUserId(
  supabase: Supabase,
  uid: string | number
): Promise<{ data: unknown[] | null; error: DbError }> {
  const withCreatedAt = await supabase
    .from(addressesTable())
    .select(USER_ADDRESS_SELECT_FIELDS)
    .eq("user_id", uid)
    .order("created_at", { ascending: true });

  if (!withCreatedAt.error) {
    return {
      data: Array.isArray(withCreatedAt.data) ? withCreatedAt.data : [],
      error: null,
    };
  }

  if (!isMissingColumn(withCreatedAt.error, "created_at")) {
    return { data: null, error: withCreatedAt.error };
  }

  const withoutCreatedAt = await supabase
    .from(addressesTable())
    .select(USER_ADDRESS_SELECT_FIELDS)
    .eq("user_id", uid)
    .order("id", { ascending: true });

  if (!withoutCreatedAt.error) {
    return {
      data: Array.isArray(withoutCreatedAt.data) ? withoutCreatedAt.data : [],
      error: null,
    };
  }

  if (isMissingColumn(withoutCreatedAt.error, "id")) {
    const unordered = await supabase.from(addressesTable()).select(USER_ADDRESS_SELECT_FIELDS).eq("user_id", uid);
    if (!unordered.error) {
      return {
        data: Array.isArray(unordered.data) ? unordered.data : [],
        error: null,
      };
    }
    return { data: null, error: unordered.error };
  }

  return { data: null, error: withoutCreatedAt.error };
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
  logAddressQueryIssue(`Could not load addresses for user_id=${String(uid)}`, byUser.error);
  return [];
}

export type DefaultUserAddressPayload = {
  label: string;
  recipient_name?: string | null;
  address_line1: string;
  address_line2: string | null;
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

async function selectAddressRowsForUser(
  supabase: Supabase,
  uid: string | number
): Promise<{ rows: AddressLiteRow[]; error: DbError }> {
  const withDefault = await supabase.from(addressesTable()).select("id,is_default").eq("user_id", uid);
  if (!withDefault.error) {
    return { rows: asLiteRows(withDefault.data), error: null };
  }
  if (!isMissingColumn(withDefault.error, "is_default")) {
    return { rows: [], error: withDefault.error };
  }
  const noDefault = await supabase.from(addressesTable()).select("id").eq("user_id", uid);
  if (noDefault.error) return { rows: [], error: noDefault.error };
  return { rows: asLiteRows(noDefault.data), error: null };
}

async function upsertDefaultByUserIdOnly(
  supabase: Supabase,
  uid: string | number,
  payload: DefaultUserAddressPayload
): Promise<{ error: { message?: string } | null }> {
  const { rows: existingRows, error: listError } = await selectAddressRowsForUser(supabase, uid);

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
      is_default: true,
    });
    return { error: u2 };
  }

  const ins = await insertWithMissingColumnFallback(supabase, {
    user_id: uid,
    ...payload,
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
  return upsertDefaultByUserIdOnly(supabase, uid, payload);
}
