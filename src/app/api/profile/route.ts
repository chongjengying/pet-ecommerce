import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import {
  cleanString,
  isMissingProfilesTable,
  loadCustomerProfileForSession,
  resolveSessionUser,
  selectProfileWithFallback,
  selectUsersWithRoleFallback,
  type ResolvedUser,
} from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { issueEmailVerificationToken } from "@/lib/emailVerification";
import {
  addressesTable,
  fetchUserAddresses,
  isMissingUserAddressesTable,
  upsertDefaultUserAddress,
} from "@/lib/userAddressDb";
import { userIdForDbQuery } from "@/lib/userIdDb";
type ProfileRequestBody = {
  email?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  full_name?: unknown;
  avatar_url?: unknown;
  phone?: unknown;
  gender?: unknown;
  dob?: unknown;
  address_label?: unknown;
  address_recipient_name?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  address_city?: unknown;
  address_state?: unknown;
  address_postal_code?: unknown;
  address_country?: unknown;
  action?: unknown;
  addressId?: unknown;
  address?: Record<string, unknown> | null;
  set_default?: unknown;
  defaultType?: unknown;
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function missingColumnName(error: unknown): string | null {
  const message = String((error as { message?: string })?.message ?? "");
  const match =
    message.match(/column ["']?([a-zA-Z0-9_]+)["']?/i) ??
    message.match(/could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i);
  return match?.[1] ?? null;
}

async function insertAddressWithSchemaFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  payload: Record<string, unknown>
) {
  const mutablePayload = { ...payload };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await supabase.from(addressesTable()).insert(mutablePayload);
    if (!result.error) {
      return result;
    }
    const missing = missingColumnName(result.error);
    if (!missing || !(missing in mutablePayload)) {
      return result;
    }
    delete mutablePayload[missing];
  }
  return { error: { message: "Could not save address because of address schema mismatch." } };
}

async function updateAddressWithSchemaFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  addressId: string,
  userIdKey: string | number,
  payload: Record<string, unknown>
) {
  const mutablePayload = { ...payload };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await supabase
      .from(addressesTable())
      .update(mutablePayload)
      .eq("id", addressId)
      .eq("user_id", userIdKey);
    if (!result.error) {
      return result;
    }
    const missing = missingColumnName(result.error);
    if (!missing || !(missing in mutablePayload)) {
      return result;
    }
    delete mutablePayload[missing];
  }
  return { error: { message: "Could not update address because of address schema mismatch." } };
}

async function buildUpdatedProfileResponse(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  session: { sub: string; username: string; email: string }
) {
  const result = await loadCustomerProfileForSession(supabase, session);
  if (!result.user) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ user: result.user });
}

async function ensureExactlyOneDefaultAddress(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
  userIdKey: string | number
): Promise<{ message?: string } | null> {
  const rows = await fetchUserAddresses(supabase, userId);
  if (rows.length === 0) {
    return null;
  }

  const chosenDefault = rows.find((row) => row.is_default_shipping ?? row.is_default) ?? rows[0];
  const addrTable = addressesTable();

  const reset = await supabase.from(addrTable).update({ is_default: false }).eq("user_id", userIdKey);
  if (reset.error && !isMissingUserAddressesTable(reset.error) && !isMissingColumn(reset.error, "is_default")) {
    return { message: reset.error.message || "Could not normalize default address." };
  }

  const resetShipping = await supabase.from(addrTable).update({ is_default_shipping: false }).eq("user_id", userIdKey);
  if (
    resetShipping.error &&
    !isMissingUserAddressesTable(resetShipping.error) &&
    !isMissingColumn(resetShipping.error, "is_default_shipping")
  ) {
    return { message: resetShipping.error.message || "Could not normalize default address." };
  }

  const mark = await supabase.from(addrTable).update({ is_default: true }).eq("id", chosenDefault.id).eq("user_id", userIdKey);
  if (mark.error && !isMissingUserAddressesTable(mark.error) && !isMissingColumn(mark.error, "is_default")) {
    return { message: mark.error.message || "Could not normalize default address." };
  }

  const markShipping = await supabase
    .from(addrTable)
    .update({ is_default_shipping: true })
    .eq("id", chosenDefault.id)
    .eq("user_id", userIdKey);
  if (
    markShipping.error &&
    !isMissingUserAddressesTable(markShipping.error) &&
    !isMissingColumn(markShipping.error, "is_default_shipping")
  ) {
    return { message: markShipping.error.message || "Could not normalize default address." };
  }

  return null;
}

function isMissingColumn(error: unknown, column: string): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    message.includes(column.toLowerCase()) &&
    message.includes("column") &&
    (message.includes("could not find") || message.includes("does not exist"))
  );
}

function buildAddressWritePayload(input: {
  label: string;
  recipientName: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal: string;
  country: string;
  setDefaultShipping?: boolean;
  setDefaultBilling?: boolean;
}): Record<string, unknown> {
  return {
    label: input.label,
    recipient_name: input.recipientName,
    address_line1: input.line1,
    address_line2: input.line2,
    city: input.city,
    state: input.state,
    postal_code: input.postal,
    country: input.country,
    ...(typeof input.setDefaultShipping === "boolean"
      ? {
          is_default: input.setDefaultShipping,
          is_default_shipping: input.setDefaultShipping,
        }
      : {}),
    ...(typeof input.setDefaultBilling === "boolean"
      ? {
          is_default_billing: input.setDefaultBilling,
        }
      : {}),
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

  const result = await loadCustomerProfileForSession(supabase, {
    sub: session.sub,
    username: session.username,
    email: session.email,
  });

  if (!result.user) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ user: result.user });
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

  let body: ProfileRequestBody;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const has = (key: keyof typeof body) => Object.prototype.hasOwnProperty.call(body, key);
  const userUpdatePayload: Record<string, unknown> = {};
  const profileExtras: Record<string, unknown> = {};
  const firstName = has("first_name") ? cleanString(body.first_name) : resolvedUser.first_name;
  const lastName = has("last_name") ? cleanString(body.last_name) : resolvedUser.last_name;
  const requestedEmail = has("email") ? normalizeEmail(body.email) : null;
  if (has("email") && requestedEmail == null) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }
  const emailChanged =
    requestedEmail != null &&
    requestedEmail !== String(resolvedUser.email ?? "").trim().toLowerCase();

  if (has("first_name")) {
    userUpdatePayload.first_name = firstName;
  }
  if (has("last_name")) {
    userUpdatePayload.last_name = lastName;
  }
  if (emailChanged && requestedEmail) {
    userUpdatePayload.email = requestedEmail;
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

  const hasAddressField =
    has("address_label") ||
    has("address_recipient_name") ||
    has("address_line1") ||
    has("address_line2") ||
    has("address_city") ||
    has("address_state") ||
    has("address_postal_code") ||
    has("address_country");
  const addrLine1 = cleanString(body.address_line1);
  const addrCity = cleanString(body.address_city);
  const addrState = cleanString(body.address_state);
  const addrPostal = cleanString(body.address_postal_code);
  const addrCountry = cleanString(body.address_country);
  if (hasAddressField) {
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
  }

  if (Object.keys(userUpdatePayload).length > 0) {
    const { error: userError } = await supabase.from("users").update(userUpdatePayload).eq("id", userIdKey);
    if (userError) {
      return NextResponse.json({ error: userError.message || "Could not update user profile." }, { status: 400 });
    }
  }

  const canonicalUserResult = await selectUsersWithRoleFallback(supabase, (fields) =>
    supabase.from("users").select(fields).eq("id", userIdKey).maybeSingle()
  );
  if (canonicalUserResult.error || canonicalUserResult.rows.length === 0) {
    return NextResponse.json(
      { error: canonicalUserResult.error || "Could not load updated user profile." },
      { status: 400 }
    );
  }
  const canonicalUser = canonicalUserResult.rows[0];

  if (emailChanged) {
    // Reset verification state for the new email so resend sends to latest address.
    await issueEmailVerificationToken(supabase, canonicalUser.id, { markUnverified: true });
  }

  let profilesTableMissing = false;
  let profileData: Record<string, unknown> | null = null;
  const { data: upsertedProfile, error: profileUpsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userIdKey,
        username: canonicalUser.username,
        first_name: canonicalUser.first_name ?? null,
        last_name: canonicalUser.last_name ?? null,
        full_name: canonicalUser.full_name,
        ...profileExtras,
      },
      { onConflict: "user_id" }
    )
    .select("id, user_id, username, first_name, last_name, full_name, avatar_url, phone, gender, dob")
    .maybeSingle();
  if (profileUpsertError) {
    if (isMissingProfilesTable(profileUpsertError)) {
      profilesTableMissing = true;
    } else {
      return NextResponse.json({ error: profileUpsertError.message || "Could not update profile details." }, { status: 400 });
    }
  } else if (upsertedProfile) {
    profileData = upsertedProfile as Record<string, unknown>;
  }

  if (hasAddressField) {
    const addrResult = await upsertDefaultUserAddress(supabase, resolvedUser.id, {
      label: cleanString(body.address_label) ?? "Home",
      recipient_name: cleanString(body.address_recipient_name),
      address_line1: addrLine1!,
      address_line2: cleanString(body.address_line2),
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
  }

  const refreshedUser: ResolvedUser = canonicalUser;

  if (!profilesTableMissing && !profileData) {
    const uid = userIdForDbQuery(refreshedUser.id);
    const { data: profileReadData, error: profileReadError } = await selectProfileWithFallback(supabase, uid);
    if (profileReadError && !isMissingProfilesTable(profileReadError)) {
      return NextResponse.json({ error: profileReadError.message || "Could not load profile details." }, { status: 400 });
    }
    if (profileReadData) {
      profileData = profileReadData as Record<string, unknown>;
    }
  }

  const addresses = await fetchUserAddresses(supabase, refreshedUser.id);

  return NextResponse.json({
    user: {
      ...refreshedUser,
      username: refreshedUser.username,
      first_name: refreshedUser.first_name ?? (profileData?.first_name as string | null | undefined) ?? null,
      last_name: refreshedUser.last_name ?? (profileData?.last_name as string | null | undefined) ?? null,
      full_name: refreshedUser.full_name ?? null,
      avatar_url: profilesTableMissing ? null : (profileData?.avatar_url as string | null | undefined) ?? null,
      phone: profilesTableMissing ? null : (profileData?.phone as string | null | undefined) ?? null,
      gender: profilesTableMissing ? null : (profileData?.gender as string | null | undefined) ?? null,
      dob: profilesTableMissing ? null : (profileData?.dob as string | null | undefined) ?? null,
      addresses,
    },
  });
}

export async function PATCH(request: Request) {
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

  let body: ProfileRequestBody;
  try {
    body = (await request.json()) as ProfileRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = String(body.action ?? "").trim();
  const addrTable = addressesTable();
  const userIdKey = userIdForDbQuery(resolvedUser.id);
  const addressId = cleanString(body.addressId);

  if (action === "address_add") {
    const address = body.address ?? {};
    const line1 = cleanString(address.address_line1);
    const city = cleanString(address.address_city ?? address.city);
    const state = cleanString(address.address_state ?? address.state);
    const postal = cleanString(address.address_postal_code ?? address.postal_code);
    const country = cleanString(address.address_country ?? address.country) ?? "MY";
    if (!line1 || !city || !state || !postal || !country) {
      return NextResponse.json({ error: "Address line 1, city, state, postal code, and country are required." }, { status: 400 });
    }
    const label = cleanString(address.address_label ?? address.label) ?? "Home";
    const recipientName = cleanString(address.address_recipient_name ?? address.recipient_name);
    const line2 = cleanString(address.address_line2);
    const setDefaultShipping = Boolean(
      address.set_default_shipping ?? address.set_default ?? body.set_default ?? false
    );
    const setDefaultBilling = Boolean(address.set_default_billing ?? false);

    if (setDefaultShipping) {
      const reset = await supabase.from(addrTable).update({ is_default: false }).eq("user_id", userIdKey);
      if (reset.error && !isMissingUserAddressesTable(reset.error) && !isMissingColumn(reset.error, "is_default")) {
        return NextResponse.json({ error: reset.error.message || "Could not update existing addresses." }, { status: 400 });
      }

      const resetShipping = await supabase.from(addrTable).update({ is_default_shipping: false }).eq("user_id", userIdKey);
      if (
        resetShipping.error &&
        !isMissingUserAddressesTable(resetShipping.error) &&
        !isMissingColumn(resetShipping.error, "is_default_shipping")
      ) {
        return NextResponse.json({ error: resetShipping.error.message || "Could not update existing addresses." }, { status: 400 });
      }
    }

    if (setDefaultBilling) {
      const resetBilling = await supabase.from(addrTable).update({ is_default_billing: false }).eq("user_id", userIdKey);
      if (
        resetBilling.error &&
        !isMissingUserAddressesTable(resetBilling.error) &&
        !isMissingColumn(resetBilling.error, "is_default_billing")
      ) {
        return NextResponse.json(
          { error: resetBilling.error.message || "Could not update existing billing defaults." },
          { status: 400 }
        );
      }
    }

    const insertRow: Record<string, unknown> = {
      user_id: userIdKey,
      ...buildAddressWritePayload({
        label,
        recipientName,
        line1,
        line2,
        city,
        state,
        postal,
        country,
        setDefaultShipping,
        setDefaultBilling,
      }),
    };
    const ins = await insertAddressWithSchemaFallback(supabase, insertRow);
    if (ins.error && !isMissingUserAddressesTable(ins.error)) {
      return NextResponse.json({ error: ins.error.message || "Could not add address." }, { status: 400 });
    }

    const defaultError = await ensureExactlyOneDefaultAddress(supabase, resolvedUser.id, userIdKey);
    if (defaultError) {
      return NextResponse.json({ error: defaultError.message || "Could not normalize default address." }, { status: 400 });
    }
    return buildUpdatedProfileResponse(supabase, session);
  }

  if (action === "address_update") {
    if (!addressId) {
      return NextResponse.json({ error: "Address id is required." }, { status: 400 });
    }
    const address = body.address ?? {};
    const line1 = cleanString(address.address_line1);
    const city = cleanString(address.address_city ?? address.city);
    const state = cleanString(address.address_state ?? address.state);
    const postal = cleanString(address.address_postal_code ?? address.postal_code);
    const country = cleanString(address.address_country ?? address.country) ?? "MY";
    if (!line1 || !city || !state || !postal || !country) {
      return NextResponse.json({ error: "Address line 1, city, state, postal code, and country are required." }, { status: 400 });
    }
    const label = cleanString(address.address_label ?? address.label) ?? "Home";
    const recipientName = cleanString(address.address_recipient_name ?? address.recipient_name);
    const line2 = cleanString(address.address_line2);
    const setDefaultShipping = Boolean(
      address.set_default_shipping ?? address.set_default ?? body.set_default ?? false
    );
    const setDefaultBilling = Boolean(address.set_default_billing ?? false);

    if (setDefaultShipping) {
      const reset = await supabase.from(addrTable).update({ is_default: false }).eq("user_id", userIdKey);
      if (reset.error && !isMissingUserAddressesTable(reset.error) && !isMissingColumn(reset.error, "is_default")) {
        return NextResponse.json({ error: reset.error.message || "Could not update existing addresses." }, { status: 400 });
      }

      const resetShipping = await supabase.from(addrTable).update({ is_default_shipping: false }).eq("user_id", userIdKey);
      if (
        resetShipping.error &&
        !isMissingUserAddressesTable(resetShipping.error) &&
        !isMissingColumn(resetShipping.error, "is_default_shipping")
      ) {
        return NextResponse.json({ error: resetShipping.error.message || "Could not update existing addresses." }, { status: 400 });
      }
    }

    if (setDefaultBilling) {
      const resetBilling = await supabase.from(addrTable).update({ is_default_billing: false }).eq("user_id", userIdKey);
      if (
        resetBilling.error &&
        !isMissingUserAddressesTable(resetBilling.error) &&
        !isMissingColumn(resetBilling.error, "is_default_billing")
      ) {
        return NextResponse.json(
          { error: resetBilling.error.message || "Could not update existing billing defaults." },
          { status: 400 }
        );
      }
    }

    const upd = await updateAddressWithSchemaFallback(
      supabase,
      addressId,
      userIdKey,
      buildAddressWritePayload({
        label,
        recipientName,
        line1,
        line2,
        city,
        state,
        postal,
        country,
        setDefaultShipping,
        setDefaultBilling,
      })
    );
    if (upd.error && !isMissingUserAddressesTable(upd.error)) {
      return NextResponse.json({ error: upd.error.message || "Could not update address." }, { status: 400 });
    }

    const defaultError = await ensureExactlyOneDefaultAddress(supabase, resolvedUser.id, userIdKey);
    if (defaultError) {
      return NextResponse.json({ error: defaultError.message || "Could not normalize default address." }, { status: 400 });
    }
    return buildUpdatedProfileResponse(supabase, session);
  }

  if (action === "address_delete") {
    if (!addressId) {
      return NextResponse.json({ error: "Address id is required." }, { status: 400 });
    }
    const del = await supabase.from(addrTable).delete().eq("id", addressId).eq("user_id", userIdKey);
    if (del.error && !isMissingUserAddressesTable(del.error)) {
      return NextResponse.json({ error: del.error.message || "Could not delete address." }, { status: 400 });
    }

    const defaultError = await ensureExactlyOneDefaultAddress(supabase, resolvedUser.id, userIdKey);
    if (defaultError) {
      return NextResponse.json({ error: defaultError.message || "Could not normalize default address." }, { status: 400 });
    }
    return buildUpdatedProfileResponse(supabase, session);
  }

  if (action === "address_set_default") {
    if (!addressId) {
      return NextResponse.json({ error: "Address id is required." }, { status: 400 });
    }
    const defaultTypeRaw = String(body.defaultType ?? "shipping").trim().toLowerCase();
    const defaultType: "shipping" | "billing" = defaultTypeRaw === "billing" ? "billing" : "shipping";

    if (defaultType === "billing") {
      const resetBilling = await supabase.from(addrTable).update({ is_default_billing: false }).eq("user_id", userIdKey);
      if (
        resetBilling.error &&
        !isMissingUserAddressesTable(resetBilling.error) &&
        !isMissingColumn(resetBilling.error, "is_default_billing")
      ) {
        return NextResponse.json(
          { error: resetBilling.error.message || "Could not update existing billing defaults." },
          { status: 400 }
        );
      }

      if (resetBilling.error && isMissingColumn(resetBilling.error, "is_default_billing")) {
        const resetShippingFallback = await supabase.from(addrTable).update({ is_default: false }).eq("user_id", userIdKey);
        if (resetShippingFallback.error && !isMissingUserAddressesTable(resetShippingFallback.error)) {
          return NextResponse.json(
            { error: resetShippingFallback.error.message || "Could not update existing addresses." },
            { status: 400 }
          );
        }
        const markShippingFallback = await supabase
          .from(addrTable)
          .update({ is_default: true })
          .eq("id", addressId)
          .eq("user_id", userIdKey);
        if (markShippingFallback.error && !isMissingUserAddressesTable(markShippingFallback.error)) {
          return NextResponse.json(
            { error: markShippingFallback.error.message || "Could not set default billing address." },
            { status: 400 }
          );
        }
      } else {
        const markBilling = await supabase
          .from(addrTable)
          .update({ is_default_billing: true })
          .eq("id", addressId)
          .eq("user_id", userIdKey);
        if (
          markBilling.error &&
          !isMissingUserAddressesTable(markBilling.error) &&
          !isMissingColumn(markBilling.error, "is_default_billing")
        ) {
          return NextResponse.json(
            { error: markBilling.error.message || "Could not set default billing address." },
            { status: 400 }
          );
        }
      }
    } else {
      const reset = await supabase.from(addrTable).update({ is_default: false }).eq("user_id", userIdKey);
      if (reset.error && !isMissingUserAddressesTable(reset.error) && !isMissingColumn(reset.error, "is_default")) {
        return NextResponse.json({ error: reset.error.message || "Could not update existing addresses." }, { status: 400 });
      }

      const resetShipping = await supabase.from(addrTable).update({ is_default_shipping: false }).eq("user_id", userIdKey);
      if (
        resetShipping.error &&
        !isMissingUserAddressesTable(resetShipping.error) &&
        !isMissingColumn(resetShipping.error, "is_default_shipping")
      ) {
        return NextResponse.json({ error: resetShipping.error.message || "Could not update existing addresses." }, { status: 400 });
      }

      const mark = await supabase
        .from(addrTable)
        .update({ is_default: true, is_default_shipping: true })
        .eq("id", addressId)
        .eq("user_id", userIdKey);
      if (
        mark.error &&
        !isMissingUserAddressesTable(mark.error) &&
        !isMissingColumn(mark.error, "is_default_shipping") &&
        !isMissingColumn(mark.error, "is_default")
      ) {
        return NextResponse.json({ error: mark.error.message || "Could not set default shipping address." }, { status: 400 });
      }
      if (
        mark.error &&
        (isMissingColumn(mark.error, "is_default_shipping") || isMissingColumn(mark.error, "is_default"))
      ) {
        const shippingFallback = await supabase
          .from(addrTable)
          .update({ is_default_shipping: true })
          .eq("id", addressId)
          .eq("user_id", userIdKey);
        if (shippingFallback.error && !isMissingUserAddressesTable(shippingFallback.error)) {
          return NextResponse.json(
            { error: shippingFallback.error.message || "Could not set default shipping address." },
            { status: 400 }
          );
        }
      }
    }

    const defaultError = await ensureExactlyOneDefaultAddress(supabase, resolvedUser.id, userIdKey);
    if (defaultError) {
      return NextResponse.json({ error: defaultError.message || "Could not normalize default address." }, { status: 400 });
    }
    return buildUpdatedProfileResponse(supabase, session);
  }

  return NextResponse.json({ error: "Unsupported profile patch action." }, { status: 400 });
}
