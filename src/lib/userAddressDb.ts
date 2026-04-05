import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";

/**
 * Supabase table for shipping rows (linked to `users` and usually `profiles`).
 * Set `SUPABASE_ADDRESSES_TABLE=addresses` in `.env.local` if your table is not `user_addresses`.
 */
export function addressesTable(): string {
  return process.env.SUPABASE_ADDRESSES_TABLE?.trim() || "user_addresses";
}

export const USER_ADDRESS_SELECT_FIELDS =
  "id,label,line1,line2,city,state,postal_code,country,is_default,created_at";

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

export function isMissingUserAddressesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  const table = addressesTable().toLowerCase();
  return (
    message.includes(table) &&
    (message.includes("does not exist") || message.includes("could not find"))
  );
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
  return {
    id: String(r.id ?? ""),
    label: typeof r.label === "string" ? r.label : "Home",
    line1: typeof r.line1 === "string" ? r.line1 : "",
    line2: typeof r.line2 === "string" ? r.line2 : null,
    city: typeof r.city === "string" ? r.city : "",
    state: typeof r.state === "string" ? r.state : null,
    postal_code: typeof r.postal_code === "string" ? r.postal_code : null,
    country: typeof r.country === "string" ? r.country : "MY",
    is_default: Boolean(r.is_default),
  };
}

async function selectAddressesByProfileOrUser(
  supabase: Supabase,
  profileId: string | null,
  uid: string | number
): Promise<{ data: unknown[] | null; error: { message?: string } | null }> {
  if (profileId) {
    const { data, error } = await supabase
      .from(addressesTable())
      .select(USER_ADDRESS_SELECT_FIELDS)
      .eq("profile_id", profileId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (!error) {
      return { data: Array.isArray(data) ? data : [], error: null };
    }
    if (!isMissingColumn(error, "profile_id")) {
      return { data: null, error };
    }
  }

  const { data, error } = await supabase
    .from(addressesTable())
    .select(USER_ADDRESS_SELECT_FIELDS)
    .eq("user_id", uid)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return { data: null, error };
  return { data: Array.isArray(data) ? data : [], error: null };
}

export async function fetchUserAddresses(supabase: Supabase, userId: string): Promise<UserAddressRow[]> {
  const uid = userIdForDbQuery(userId);
  const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", uid).maybeSingle();
  const profileId = prof?.id != null ? String(prof.id) : null;

  const { data, error } = await selectAddressesByProfileOrUser(supabase, profileId, uid);
  if (error) {
    if (isMissingUserAddressesTable(error)) return [];
    return [];
  }
  if (!data) return [];
  return data.map((row) => mapUserAddressRow(row as Record<string, unknown>));
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

async function upsertDefaultByUserIdOnly(
  supabase: Supabase,
  uid: string | number,
  payload: DefaultUserAddressPayload
): Promise<{ error: { message?: string } | null }> {
  const { data: existingRows, error: listError } = await supabase
    .from(addressesTable())
    .select("id,is_default")
    .eq("user_id", uid);

  if (listError) {
    if (isMissingUserAddressesTable(listError)) return { error: null };
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
    if (u1) return { error: u1 };

    const { error: u2 } = await supabase
      .from(addressesTable())
      .update({
        ...payload,
        is_default: true,
      })
      .eq("id", id);
    return { error: u2 };
  }

  const { error: ins } = await supabase.from(addressesTable()).insert({
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

  const { data: prof, error: profErr } = await supabase.from("profiles").select("id").eq("user_id", uid).maybeSingle();
  if (profErr) {
    return { error: profErr };
  }
  const profileId = prof?.id != null ? String(prof.id) : null;
  if (!profileId) {
    return { error: { message: "Profile row is required before saving an address." } };
  }

  const { data: existingRows, error: listError } = await supabase
    .from(addressesTable())
    .select("id,is_default")
    .eq("profile_id", profileId);

  if (listError) {
    if (isMissingUserAddressesTable(listError)) {
      return { error: null };
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
      if (isMissingColumn(u1, "profile_id")) {
        return upsertDefaultByUserIdOnly(supabase, uid, payload);
      }
      return { error: u1 };
    }

    const { error: u2 } = await supabase
      .from(addressesTable())
      .update({
        ...payload,
        is_default: true,
      })
      .eq("id", id);
    return { error: u2 };
  }

  const insertRow: Record<string, unknown> = {
    user_id: uid,
    profile_id: profileId,
    ...payload,
    is_default: true,
  };
  const { error: ins } = await supabase.from(addressesTable()).insert(insertRow);
  if (ins && isMissingColumn(ins, "profile_id")) {
    delete insertRow.profile_id;
    const retry = await supabase.from(addressesTable()).insert(insertRow);
    return { error: retry.error };
  }
  return { error: ins };
}
