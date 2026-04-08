"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearProfileCache,
  readProfileCache,
  writeProfileCache,
  type ProfileAddress,
} from "@/lib/profileCache";
import ProfileSkeleton from "@/components/auth/ProfileSkeleton";
import { getAvatarInitials, UserAvatar } from "@/components/ui/UserAvatar";

type ProfileUser = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  addresses?: ProfileAddress[];
};

type ProfileClientProps = {
  initialUser?: ProfileUser | null;
  initialError?: string | null;
};

type AddressDraft = {
  id?: string;
  label: "Home" | "Work" | "Office";
  recipient_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  set_default: boolean;
};

const REGIONS_BY_COUNTRY: Record<string, string[]> = {
  MY: [
    "Johor",
    "Kedah",
    "Kelantan",
    "Kuala Lumpur",
    "Labuan",
    "Malacca",
    "Negeri Sembilan",
    "Pahang",
    "Penang",
    "Perak",
    "Perlis",
    "Putrajaya",
    "Sabah",
    "Sarawak",
    "Selangor",
    "Terengganu",
  ],
  SG: ["Central", "East", "North", "North-East", "West"],
  US: [
    "California",
    "Florida",
    "New York",
    "Texas",
    "Washington",
  ],
  TH: ["Bangkok", "Chiang Mai", "Chonburi", "Phuket", "Songkhla"],
  ID: ["Bali", "Banten", "DKI Jakarta", "Jawa Barat", "Jawa Timur"],
};


function defaultShippingAddress(user: ProfileUser): ProfileAddress | null {
  if (!user.addresses?.length) return null;
  return user.addresses.find((address) => address.is_default) ?? user.addresses[0] ?? null;
}

function normalizeGender(value: string | null | undefined): "" | "male" | "female" {
  return value === "male" || value === "female" ? value : "";
}

function normalizeAddressLabel(value: string | null | undefined): "Home" | "Work" | "Office" {
  const normalizedValue = (value ?? "").trim().toLowerCase();
  if (normalizedValue === "work") return "Work";
  if (normalizedValue === "office") return "Office";
  return "Home";
}

function displayUsername(raw: string | undefined | null): string {
  if (raw == null || String(raw).trim() === "") return "--";
  return String(raw).trim().replace(/^@+/, "");
}

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeCountryCode(value: string | null | undefined): string {
  const code = (value ?? "").trim().toUpperCase();
  return code || "MY";
}

function hasCompleteShippingAddress(address: ProfileAddress | null): boolean {
  if (!address) return false;
  return (
    hasValue(address.address_line1) &&
    hasValue(address.city) &&
    hasValue(address.state) &&
    hasValue(address.postal_code) &&
    hasValue(address.country)
  );
}

function formatAddressSummary(address: ProfileAddress | null): string {
  if (!address) return "No default shipping address saved yet.";

  const lineParts = [
    address.recipient_name ?? null,
    address.address_line1,
    address.address_line2 ?? null,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].filter((value): value is string => hasValue(value));

  return lineParts.length > 0 ? lineParts.join(", ") : "Address saved but still incomplete.";
}

function completionScore(user: ProfileUser, address: ProfileAddress | null): number {
  const checks = [
    hasValue(user.full_name),
    hasValue(user.phone),
    hasValue(user.dob),
    hasCompleteShippingAddress(address),
  ];

  const completeCount = checks.filter(Boolean).length;
  return Math.round((completeCount / checks.length) * 100);
}

function statusTone(complete: boolean): string {
  return complete
    ? "border-emerald-200/90 bg-emerald-50 text-emerald-900"
    : "border-amber-200/90 bg-amber-50 text-amber-950";
}

function withSingleDefault(addresses: ProfileAddress[] | undefined): ProfileAddress[] {
  if (!addresses?.length) return [];
  let defaultAssigned = false;
  const normalized = addresses.map((address, index) => {
    const makeDefault = !defaultAssigned && (address.is_default || index === 0);
    if (makeDefault) defaultAssigned = true;
    return { ...address, is_default: makeDefault };
  });
  return normalized.sort((left, right) => Number(right.is_default) - Number(left.is_default));
}

function applySelectedDefaultAddress(
  currentUser: ProfileUser | null,
  addressId: string
): ProfileUser | null {
  if (!currentUser?.addresses?.length) {
    return currentUser;
  }

  return {
    ...currentUser,
    addresses: currentUser.addresses.map((address) => ({
      ...address,
      is_default: address.id === addressId,
    })),
  };
}

function toAddressDraft(address?: ProfileAddress | null): AddressDraft {
  return {
    id: address?.id,
    label: normalizeAddressLabel(address?.label),
    recipient_name: address?.recipient_name ?? "",
    address_line1: address?.address_line1 ?? "",
    address_line2: address?.address_line2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postal_code: address?.postal_code ?? "",
    country: normalizeCountryCode(address?.country ?? "MY"),
    set_default: Boolean(address?.is_default),
  };
}

export default function ProfileClient({
  initialUser = null,
  initialError = null,
}: ProfileClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetupFlow = searchParams.get("setup") === "1";

  const [loading, setLoading] = useState(() => !initialUser && !initialError);
  const [user, setUser] = useState<ProfileUser | null>(initialUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [regionDraft, setRegionDraft] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<"Home" | "Work" | "Office" | null>(null);
  const [addressEditorMode, setAddressEditorMode] = useState<"add" | "edit" | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(toAddressDraft(null));
  const [expandedAddressId, setExpandedAddressId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;

    if (initialUser && token) {
      writeProfileCache(token, initialUser);
      setLoading(false);
    }

    const cached = !initialUser ? readProfileCache(token) : null;
    if (!initialUser && cached) {
      setUser(cached);
      setLoading(false);
    }

    const loadUser = async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!active) return;

        if (!res.ok) {
          if (res.status === 401) {
            clearProfileCache();
            setUser(null);
            router.replace("/auth/login?next=/profile");
            return;
          }

          const failure = (await res.json().catch(() => ({}))) as { error?: string };
          if (!initialUser && !cached) {
            setError(failure.error || "Could not load profile.");
          } else {
            setNotice((current) => current ?? "Showing your latest saved profile details while live refresh catches up.");
          }
          return;
        }

        const payload = (await res.json().catch(() => ({}))) as { user?: ProfileUser };
        if (!payload.user) {
          router.replace("/auth/login?next=/profile");
          return;
        }

        setError(null);
        setNotice(null);
        setUser(payload.user);
        if (token) {
          writeProfileCache(token, payload.user);
        }
      } catch {
        if (!active) return;
        if (!initialUser && !cached) {
          setError("Could not load profile.");
        } else {
          setNotice((current) => current ?? "Profile refresh is temporarily unavailable. Your saved details are still shown.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadUser();
    return () => {
      active = false;
    };
  }, [initialUser, router]);

  const onSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearProfileCache();
    localStorage.removeItem("customer_jwt_token");
    window.dispatchEvent(new Event("customer-auth-changed"));
    router.replace("/");
    router.refresh();
  };

  const onSave = async (formData: FormData) => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, string> = {
      full_name: formData.get("full_name")?.toString() ?? "",
      phone: formData.get("phone")?.toString() ?? "",
      gender: formData.get("gender")?.toString() ?? "",
      dob: formData.get("dob")?.toString() ?? "",
    };

    try {
      const data = await saveProfilePayload(payload);
      if (!data) return;
      setFormKey((current) => current + 1);
      setSuccess("Profile updated. Your shipping details are ready for checkout.");
    } finally {
      setSaving(false);
    }
  };

  const saveProfilePayload = async (payload: Record<string, string>): Promise<ProfileUser | null> => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; user?: ProfileUser };
      if (!res.ok || !data.user) {
        setError(data.error || "Could not save profile.");
        return null;
      }

      setNotice(null);
      setUser(data.user);
      setRegionDraft(null);
      setLabelDraft(null);
      if (token) {
        writeProfileCache(token, data.user);
      }
      return data.user;
    } catch {
      setError("Could not save profile.");
      return null;
    }
  };

  const patchAddress = async (payload: Record<string, unknown>): Promise<ProfileUser | null> => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; user?: ProfileUser };
      if (!res.ok || !data.user) {
        setError(data.error || "Could not update address.");
        return null;
      }
      setUser(data.user);
      if (token) {
        writeProfileCache(token, data.user);
      }
      return data.user;
    } catch {
      setError("Could not update address.");
      return null;
    }
  };

  const onSetDefaultAddress = async (address: ProfileAddress) => {
    const previousUser = user;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setExpandedAddressId(address.id);
    setUser((current) => applySelectedDefaultAddress(current, address.id));
    try {
      const data = await patchAddress({ action: "address_set_default", addressId: address.id });
      if (!data) {
        setUser(previousUser);
        return;
      }
      setSuccess("Default address updated.");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteAddress = async (addressId: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await patchAddress({ action: "address_delete", addressId });
      if (!data) return;
      setSuccess("Address removed.");
    } finally {
      setSaving(false);
    }
  };

  const openAddAddress = () => {
    setAddressDraft(toAddressDraft(null));
    setAddressEditorMode("add");
    setExpandedAddressId(null);
  };

  const openEditAddress = (address: ProfileAddress) => {
    setAddressDraft(toAddressDraft(address));
    setAddressEditorMode("edit");
    setExpandedAddressId(address.id);
  };

  const onSaveAddress = async () => {
    const required = (v: string) => v.trim().length > 0;
    if (
      !required(addressDraft.recipient_name) ||
      !required(addressDraft.address_line1) ||
      !required(addressDraft.city) ||
      !required(addressDraft.state) ||
      !required(addressDraft.postal_code) ||
      !required(addressDraft.country)
    ) {
      setError("Recipient name, address line 1, city, state, postal code, and country are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const base = {
        address_label: addressDraft.label,
        address_recipient_name: addressDraft.recipient_name,
        address_line1: addressDraft.address_line1,
        address_line2: addressDraft.address_line2,
        address_city: addressDraft.city,
        address_state: addressDraft.state,
        address_postal_code: addressDraft.postal_code,
        address_country: addressDraft.country,
        set_default: addressDraft.set_default,
      };
      const payload =
        addressEditorMode === "edit" && addressDraft.id
          ? { action: "address_update", addressId: addressDraft.id, address: base }
          : { action: "address_add", address: base };
      const data = await patchAddress(payload);
      if (!data) return;
      setAddressEditorMode(null);
      setAddressDraft(toAddressDraft(null));
      setExpandedAddressId(null);
      setSuccess(addressEditorMode === "edit" ? "Address updated." : "Address added.");
    } finally {
      setSaving(false);
    }
  };

  const userHandle = displayUsername(user?.username);
  const greetingName = user?.full_name?.trim() || userHandle;
  const initials = getAvatarInitials(user?.full_name ?? null, user?.username?.replace(/^@+/, "") ?? "");
  const shippingAddress = user ? defaultShippingAddress(user) : null;
  const normalizedAddresses = withSingleDefault(user?.addresses);
  const selectedGender = normalizeGender(user?.gender);
  const selectedAddressLabel = labelDraft ?? normalizeAddressLabel(shippingAddress?.label);
  const selectedCountry = "MY";
  const selectedRegion = regionDraft ?? (shippingAddress?.state ?? "");
  const selectedCity = shippingAddress?.city ?? "";
  const selectedPostcode = shippingAddress?.postal_code ?? "";
  const liveAddressPreview = [
    selectedAddressLabel,
    shippingAddress?.recipient_name ?? "",
    shippingAddress?.address_line1 ?? "",
    selectedCity,
    selectedRegion,
    selectedPostcode,
    selectedCountry,
  ]
    .filter((value) => hasValue(value))
    .join(", ");

  const readiness = useMemo(() => {
    if (!user) {
      return {
        addressSummary: "No profile loaded yet.",
        completion: 0,
        checkoutReady: false,
        contactReady: false,
      };
    }

    return {
      addressSummary: formatAddressSummary(shippingAddress),
      completion: completionScore(user, shippingAddress),
      checkoutReady: hasCompleteShippingAddress(shippingAddress),
      contactReady: hasValue(user.full_name) && hasValue(user.phone),
    };
  }, [shippingAddress, user]);

  if (loading && !user) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-sm">
        <p className="text-sm text-red-700">{error || "Could not load profile details."}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-amber-200/70 bg-white shadow-[0_18px_55px_rgba(44,36,32,0.08)]">
      <div className="border-b border-amber-100/90 bg-[radial-gradient(circle_at_top_left,_rgba(120,146,111,0.16),_transparent_34%),linear-gradient(135deg,rgba(255,255,255,1),rgba(248,242,229,0.92),rgba(255,249,240,0.92))] px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <UserAvatar src={user.avatar_url} alt={greetingName} initials={initials} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-umber/45">Customer profile</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-umber sm:text-3xl">Hi, {greetingName}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(readiness.checkoutReady)}`}
              >
                {readiness.checkoutReady ? "Checkout ready" : "Address needed"}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-umber/68">
              Keep your delivery details current so checkout, order confirmation, and support follow-up stay accurate
              in real time.
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-umber/65">
              <div className="flex items-baseline gap-2">
                <dt className="text-umber/45">Username</dt>
                <dd className="font-medium text-umber">{userHandle}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-umber/45">Email</dt>
                <dd className="font-medium text-umber">{user.email || "--"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Profile strength</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-3xl font-semibold tracking-tight text-umber">{readiness.completion}%</p>
              <p className="text-xs text-umber/55">Live completeness based on delivery-ready details.</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sage via-sage/90 to-amber-400"
                style={{ width: `${readiness.completion}%` }}
              />
            </div>
          </article>

          <article className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Checkout status</p>
            <p className="mt-3 text-base font-semibold text-umber">
              {readiness.checkoutReady ? "Delivery details complete" : "Finish your shipping address"}
            </p>
            <p className="mt-2 text-sm leading-6 text-umber/62">
              {readiness.checkoutReady
                ? "This address will be used as your default destination during checkout."
                : "Add the missing shipping fields below so cart checkout can go through smoothly."}
            </p>
          </article>

          <article className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Default delivery</p>
            <p className="mt-3 text-base font-semibold text-umber">
              {selectedAddressLabel || "No address label yet"}
            </p>
            <p className="mt-2 text-sm leading-6 text-umber/62">
              {hasValue(liveAddressPreview) ? liveAddressPreview : readiness.addressSummary}
            </p>
          </article>
        </div>

        {(isSetupFlow || !readiness.checkoutReady) && (
          <p className="mt-6 rounded-2xl border border-amber-200/85 bg-white/90 px-4 py-3 text-sm leading-relaxed text-amber-950/90">
            Add a full shipping address now to unlock faster ecommerce checkout and make sure order confirmations use
            the right delivery details.
          </p>
        )}

      </div>

      <form
        key={formKey}
        className="px-6 py-8 sm:px-10 sm:py-9"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          void onSave(formData);
        }}
      >
        <section aria-labelledby="account-heading" className="pb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="account-heading" className="text-sm font-semibold text-umber">
                Account
              </h2>
              <p className="mt-1 text-xs text-umber/55">Your sign-in identity stays fixed here.</p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                readiness.contactReady
              )}`}
            >
              {readiness.contactReady ? "Contact ready" : "Add phone details"}
            </span>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-100/90 bg-cream/55 px-4 py-4">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-umber/45">Email</dt>
              <dd className="mt-1.5 break-all text-sm font-medium text-umber">{user.email || "--"}</dd>
            </div>
            <div className="rounded-2xl border border-amber-100/90 bg-cream/55 px-4 py-4">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-umber/45">Username</dt>
              <dd className="mt-1.5 text-sm font-medium text-umber">{userHandle}</dd>
            </div>
          </dl>
        </section>

        <div className="border-t border-amber-100/90" />

        <section aria-labelledby="details-heading" className="pt-8">
          <h2 id="details-heading" className="text-sm font-semibold text-umber">
            Personal details
          </h2>
          <p className="mt-1 text-xs text-umber/55">
            These details help delivery, support, and order follow-up stay accurate.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Full name</span>
              <input
                name="full_name"
                defaultValue={user.full_name ?? ""}
                autoComplete="name"
                className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="Your name"
              />
            </label>

            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Phone</span>
              <input
                name="phone"
                defaultValue={user.phone ?? ""}
                autoComplete="tel"
                className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="+60 12 345 6789"
              />
            </label>

            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Gender</span>
              <select
                name="gender"
                defaultValue={selectedGender}
                className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>

            <label className="block space-y-1.5 sm:col-span-1 sm:max-w-xs">
              <span className="text-sm font-medium text-umber/90">Date of birth</span>
              <input
                type="date"
                name="dob"
                defaultValue={user.dob ?? ""}
                className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
              />
            </label>
          </div>
          <div className="mt-8">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-umber px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-umber/92 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save account"}
            </button>
          </div>
        </section>

        <section aria-labelledby="address-heading" className="pt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="address-heading" className="text-sm font-semibold text-umber">
                My addresses
              </h2>
              <p className="mt-1 text-xs text-umber/55">
                Manage saved addresses for faster checkout. Only one address can be default at a time.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddAddress}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              + Add New Address
            </button>
          </div>

          {normalizedAddresses.length > 0 ? (
            <div className="mt-6 space-y-4">
              {normalizedAddresses.map((address) => {
                const isExpanded = expandedAddressId === address.id;
                const summaryLine = [address.address_line1, address.city, address.state, address.postal_code, "Malaysia"]
                  .filter((value) => hasValue(value))
                  .join(", ");
                const fullLine = [address.address_line1, address.address_line2, address.city, address.state, address.postal_code, "Malaysia"]
                  .filter((value) => hasValue(value))
                  .join(", ");

                return (
                  <article
                    key={address.id}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                      address.is_default
                        ? "border-emerald-200/90 bg-[linear-gradient(180deg,rgba(240,253,244,0.92),rgba(255,255,255,1))] shadow-[0_14px_34px_rgba(16,185,129,0.10)]"
                        : "border-amber-100/90"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedAddressId((current) => (current === address.id ? null : address.id))}
                      className="flex w-full items-start justify-between gap-4 p-5 text-left"
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-umber">{normalizeAddressLabel(address.label)}</p>
                          {address.is_default ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                              Default address
                            </span>
                          ) : (
                            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
                              Saved address
                            </span>
                          )}
                        </div>
                        {hasValue(address.recipient_name) ? (
                          <p className="mt-2 text-sm font-medium text-umber/85">{address.recipient_name}</p>
                        ) : null}
                        <p className="mt-1 text-sm leading-6 text-umber/72">{summaryLine}</p>
                      </div>
                      <span
                        className={`inline-flex min-w-[96px] items-center justify-end rounded-full px-3 py-1 text-xs font-semibold ${
                          isExpanded ? "bg-amber-100 text-amber-900" : "bg-white text-umber/55"
                        }`}
                      >
                        {isExpanded ? "Collapse" : "Expand"}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-amber-100/90 bg-cream/35 px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-2xl border border-amber-100/80 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">
                              Category
                            </p>
                            <p className="mt-2 text-sm font-medium text-umber">{normalizeAddressLabel(address.label)}</p>
                          </div>
                          <div className="rounded-2xl border border-amber-100/80 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">
                              Recipient name
                            </p>
                            <p className="mt-2 text-sm font-medium text-umber">{address.recipient_name || "No recipient name yet"}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-2xl border border-amber-100/80 bg-white px-4 py-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">
                              Address line 1
                            </p>
                            <p className="mt-2 text-sm leading-7 text-umber/80">{address.address_line1 || "-"}</p>
                          </div>
                          <div className="rounded-2xl border border-amber-100/80 bg-white px-4 py-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">
                              Address line 2
                            </p>
                            <p className="mt-2 text-sm leading-7 text-umber/80">{address.address_line2 || "-"}</p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-amber-100/80 bg-white px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">
                            Full address
                          </p>
                          <p className="mt-2 text-sm leading-7 text-umber/80">{fullLine}</p>
                        </div>

                        <div className="mt-4 rounded-2xl border border-amber-100/80 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">
                            Default status
                          </p>
                          <p className="mt-2 text-sm font-medium text-umber">
                            {address.is_default ? "This is your only default address." : "You can switch this to the default address."}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEditAddress(address)}
                            className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-amber-200/90 bg-white px-4 py-2 text-sm font-semibold text-umber transition hover:bg-amber-50"
                          >
                            Edit address
                          </button>
                          {!address.is_default ? (
                            <button
                              type="button"
                              onClick={() => void onSetDefaultAddress(address)}
                              disabled={saving}
                              className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white transition hover:bg-sage/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Set as default
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void onDeleteAddress(address.id)}
                            disabled={saving}
                            className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Delete address
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-amber-100/90 bg-cream/45 p-4 text-sm text-umber/70">
              No address yet. Add your first address for checkout.
            </div>
          )}

          {addressEditorMode ? (
            <div className="mt-6 rounded-2xl border border-amber-200/90 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-umber">
                  {addressEditorMode === "add" ? "Add new address" : "Edit address"}
                </p>
                <button
                  type="button"
                  onClick={() => setAddressEditorMode(null)}
                  className="text-xs font-semibold text-umber/60 hover:text-umber"
                >
                  Cancel
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-umber/90">Label</span>
                  <select
                    value={addressDraft.label}
                    onChange={(event) =>
                      setAddressDraft((draft) => ({ ...draft, label: event.target.value as AddressDraft["label"] }))
                    }
                    className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm text-umber outline-none focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                  >
                    <option value="Home">Home</option>
                    <option value="Work">Work</option>
                    <option value="Office">Office</option>
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-umber/90">Recipient name</span>
                  <input
                    value={addressDraft.recipient_name}
                    onChange={(event) => setAddressDraft((draft) => ({ ...draft, recipient_name: event.target.value }))}
                    className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm text-umber outline-none focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                    placeholder="Name receiving this order"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-umber/90">State / region</span>
                  <select
                    value={addressDraft.state}
                    onChange={(event) => setAddressDraft((draft) => ({ ...draft, state: event.target.value }))}
                    className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm text-umber outline-none focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                  >
                    <option value="">Select state / region</option>
                    {REGIONS_BY_COUNTRY.MY.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-umber/90">Address line 1</span>
                  <input
                    value={addressDraft.address_line1}
                    onChange={(event) => setAddressDraft((draft) => ({ ...draft, address_line1: event.target.value }))}
                    className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm text-umber outline-none focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                    placeholder="Street, building, unit"
                  />
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-umber/90">Address line 2</span>
                  <input
                    value={addressDraft.address_line2}
                    onChange={(event) => setAddressDraft((draft) => ({ ...draft, address_line2: event.target.value }))}
                    className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm text-umber outline-none focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                    placeholder="Apartment, floor (optional)"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-umber/90">City</span>
                  <input
                    value={addressDraft.city}
                    onChange={(event) => setAddressDraft((draft) => ({ ...draft, city: event.target.value }))}
                    className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm text-umber outline-none focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                    placeholder="City"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-umber/90">Postal code</span>
                  <input
                    value={addressDraft.postal_code}
                    onChange={(event) => setAddressDraft((draft) => ({ ...draft, postal_code: event.target.value }))}
                    className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm text-umber outline-none focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                    placeholder="Postcode"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-umber/90">Country</span>
                  <input
                    value="Malaysia"
                    readOnly
                    aria-readonly="true"
                    className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-sm text-umber"
                  />
                </label>

                <label className="sm:col-span-2 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={addressDraft.set_default}
                    onChange={(event) => setAddressDraft((draft) => ({ ...draft, set_default: event.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-umber focus:ring-sage/40"
                  />
                  <span className="text-sm text-umber/80">Set as default address</span>
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void onSaveAddress()}
                  disabled={saving}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-umber px-4 py-2 text-sm font-semibold text-white transition hover:bg-umber/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : addressEditorMode === "add" ? "Add address" : "Save address"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {error ? (
          <p
            className="mt-6 rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-6 rounded-2xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
            {success}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-6 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            {notice}
          </p>
        ) : null}

        <div className="mt-10 flex flex-col gap-3 border-t border-amber-100/90 pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={() => router.push("/products")}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-amber-200/90 bg-white px-6 py-2.5 text-sm font-semibold text-umber shadow-sm transition hover:bg-amber-50/80"
            >
              Continue shopping
            </button>
          </div>

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="text-sm font-medium text-umber/50 underline-offset-4 transition hover:text-umber hover:underline sm:ml-auto"
          >
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
