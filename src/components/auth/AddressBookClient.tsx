"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearProfileCache,
  readProfileCache,
  writeProfileCache,
  type ProfileAddress,
} from "@/lib/profileCache";
import ProfileSkeleton from "@/components/auth/ProfileSkeleton";

type ProfileUser = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url?: string | null;
  addresses?: ProfileAddress[];
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
  set_default_shipping: boolean;
  set_default_billing: boolean;
};

type AddressBookClientProps = {
  initialUser?: ProfileUser | null;
  initialError?: string | null;
};

const REGIONS_MY = [
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
];

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeAddressLabel(value: string | null | undefined): "Home" | "Work" | "Office" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "work") return "Work";
  if (normalized === "office") return "Office";
  return "Home";
}

function normalizeAddressDefaults(address: ProfileAddress, index: number): ProfileAddress {
  const isDefaultShipping = address.is_default_shipping ?? address.is_default ?? index === 0;
  const isDefaultBilling =
    address.is_default_billing ?? (address.is_default_shipping ?? address.is_default ?? index === 0);

  return {
    ...address,
    is_default: isDefaultShipping,
    is_default_shipping: isDefaultShipping,
    is_default_billing: isDefaultBilling,
  };
}

function normalizeAddresses(addresses: ProfileAddress[] | undefined): ProfileAddress[] {
  if (!addresses?.length) return [];
  return addresses
    .map((address, index) => normalizeAddressDefaults(address, index))
    .sort((left, right) => {
      const leftScore = Number(Boolean(left.is_default_shipping)) + Number(Boolean(left.is_default_billing));
      const rightScore = Number(Boolean(right.is_default_shipping)) + Number(Boolean(right.is_default_billing));
      return rightScore - leftScore;
    });
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
    country: (address?.country ?? "MY").trim().toUpperCase() || "MY",
    set_default_shipping: Boolean(address?.is_default_shipping ?? address?.is_default),
    set_default_billing: Boolean(address?.is_default_billing ?? address?.is_default),
  };
}

function applySelectedDefaultAddress(
  currentUser: ProfileUser | null,
  addressId: string,
  defaultType: "shipping" | "billing"
): ProfileUser | null {
  if (!currentUser?.addresses?.length) return currentUser;

  return {
    ...currentUser,
    addresses: currentUser.addresses.map((address) => {
      if (defaultType === "billing") {
        return {
          ...address,
          is_default_billing: address.id === addressId,
        };
      }
      return {
        ...address,
        is_default: address.id === addressId,
        is_default_shipping: address.id === addressId,
      };
    }),
  };
}

export default function AddressBookClient({
  initialUser = null,
  initialError = null,
}: AddressBookClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(() => !initialUser && !initialError);
  const [user, setUser] = useState<ProfileUser | null>(initialUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addressEditorMode, setAddressEditorMode] = useState<"add" | "edit" | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(toAddressDraft(null));
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;

    if (initialUser && token) {
      writeProfileCache(token, initialUser);
      setLoading(false);
      return () => {
        active = false;
      };
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
            router.replace("/auth/login?next=/address-book");
            return;
          }

          const failure = (await res.json().catch(() => ({}))) as { error?: string };
          if (!initialUser && !cached) {
            setError(failure.error || "Could not load addresses.");
          } else {
            setNotice((current) => current ?? "Showing your latest saved addresses while live refresh catches up.");
          }
          return;
        }

        const payload = (await res.json().catch(() => ({}))) as { user?: ProfileUser };
        if (!payload.user) {
          router.replace("/auth/login?next=/address-book");
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
          setError("Could not load addresses.");
        } else {
          setNotice((current) => current ?? "Address refresh is temporarily unavailable. Your saved details are still shown.");
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const triggerAdd = () => {
      if (window.location.hash.toLowerCase() === "#add") {
        setAddressDraft(toAddressDraft(null));
        setAddressEditorMode("add");
      }
    };

    triggerAdd();
    window.addEventListener("hashchange", triggerAdd);
    return () => window.removeEventListener("hashchange", triggerAdd);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-address-menu-root='true']")) {
        setOpenMenuId(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };
    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

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
      if (res.status === 401) {
        clearProfileCache();
        localStorage.removeItem("customer_jwt_token");
        window.dispatchEvent(new Event("customer-auth-changed"));
        router.replace("/auth/login?next=/address-book");
        return null;
      }
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

  const onSetDefaultAddress = async (addressId: string, defaultType: "shipping" | "billing") => {
    const previousUser = user;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setUser((current) => applySelectedDefaultAddress(current, addressId, defaultType));
    try {
      const data = await patchAddress({ action: "address_set_default", addressId, defaultType });
      if (!data) {
        setUser(previousUser);
        return;
      }
      setOpenMenuId(null);
      setSuccess(defaultType === "shipping" ? "Default shipping address updated." : "Default billing address updated.");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteAddress = async (addressId: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this address?");
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await patchAddress({ action: "address_delete", addressId });
      if (!data) return;
      setOpenMenuId(null);
      setSuccess("Address removed.");
    } finally {
      setSaving(false);
    }
  };

  const onSaveAddress = async () => {
    const required = (value: string) => value.trim().length > 0;
    if (
      !required(addressDraft.address_line1) ||
      !required(addressDraft.city) ||
      !required(addressDraft.state) ||
      !required(addressDraft.postal_code) ||
      !required(addressDraft.country)
    ) {
      setError("Address line 1, city, state, postal code, and country are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload =
        addressEditorMode === "edit" && addressDraft.id
          ? {
              action: "address_update",
              addressId: addressDraft.id,
              address: {
                address_label: addressDraft.label,
                address_recipient_name: addressDraft.recipient_name,
                address_line1: addressDraft.address_line1,
                address_line2: addressDraft.address_line2,
                address_city: addressDraft.city,
                address_state: addressDraft.state,
                address_postal_code: addressDraft.postal_code,
                address_country: addressDraft.country,
                set_default_shipping: addressDraft.set_default_shipping,
                set_default_billing: addressDraft.set_default_billing,
              },
            }
          : {
              action: "address_add",
              address: {
                address_label: addressDraft.label,
                address_recipient_name: addressDraft.recipient_name,
                address_line1: addressDraft.address_line1,
                address_line2: addressDraft.address_line2,
                address_city: addressDraft.city,
                address_state: addressDraft.state,
                address_postal_code: addressDraft.postal_code,
                address_country: addressDraft.country,
                set_default_shipping: addressDraft.set_default_shipping,
                set_default_billing: addressDraft.set_default_billing,
              },
            };

      const data = await patchAddress(payload);
      if (!data) return;

      setAddressEditorMode(null);
      setAddressDraft(toAddressDraft(null));
      setOpenMenuId(null);
      setSuccess(addressEditorMode === "edit" ? "Address updated." : "Address added.");
    } finally {
      setSaving(false);
    }
  };

  const normalizedAddresses = useMemo(() => normalizeAddresses(user?.addresses), [user?.addresses]);
  const actionsDisabled = saving || addressEditorMode !== null;
  const effectiveAddressCount = normalizedAddresses.length + (addressEditorMode === "add" ? 1 : 0);
  const showDefaultShippingToggle = effectiveAddressCount > 1;

  if (loading && !user) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-red-200/80 bg-white p-8 shadow-sm">
        <p className="text-sm text-red-700">{error || "Could not load address book."}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="border-b border-zinc-100 px-6 py-7 sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Address Book</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Manage saved addresses</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Keep delivery and billing details up to date for faster checkout.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
            >
              Back to profile
            </button>
            <button
              type="button"
              onClick={() => {
                setAddressDraft(toAddressDraft(null));
                setAddressEditorMode("add");
              }}
              disabled={saving}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add new address
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-7 sm:px-10 sm:py-8">
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3">
          <p className="text-sm font-medium text-zinc-700">
            {normalizedAddresses.length > 0
              ? `${normalizedAddresses.length} saved ${normalizedAddresses.length === 1 ? "address" : "addresses"}`
              : "No saved addresses"}
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Address Settings</p>
        </div>
        {normalizedAddresses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {normalizedAddresses.map((address) => {
              const isDefaultShipping = Boolean(address.is_default_shipping ?? address.is_default);
              const isDefaultBilling = Boolean(address.is_default_billing ?? address.is_default);
              const line = [
                address.address_line1,
                address.address_line2,
                address.city,
                address.state,
                address.postal_code,
                address.country === "MY" ? "Malaysia" : address.country,
              ]
                .filter((value) => hasValue(value))
                .join(", ");

              return (
                <article
                  key={address.id}
                  className="group rounded-2xl border border-zinc-200 bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zinc-900 transition-colors group-hover:text-zinc-950">
                        {normalizeAddressLabel(address.label)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {isDefaultShipping ? (
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700">
                            Default shipping
                          </span>
                        ) : null}
                        {isDefaultBilling ? (
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700">
                            Default billing
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative" data-address-menu-root="true">
                      <button
                        type="button"
                        aria-expanded={openMenuId === address.id}
                        aria-haspopup="menu"
                        aria-label={`More actions for ${normalizeAddressLabel(address.label)} address`}
                        onClick={() => setOpenMenuId((current) => (current === address.id ? null : address.id))}
                        disabled={actionsDisabled}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
                          <circle cx="10" cy="4" r="1.6" />
                          <circle cx="10" cy="10" r="1.6" />
                          <circle cx="10" cy="16" r="1.6" />
                        </svg>
                      </button>
                      {openMenuId === address.id ? (
                        <div
                          role="menu"
                          className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg"
                        >
                          {!isDefaultShipping ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void onSetDefaultAddress(address.id, "shipping")}
                              disabled={actionsDisabled}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Set as default shipping
                            </button>
                          ) : null}
                          {!isDefaultBilling ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void onSetDefaultAddress(address.id, "billing")}
                              disabled={actionsDisabled}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Set as default billing
                            </button>
                          ) : null}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void onDeleteAddress(address.id)}
                            disabled={actionsDisabled}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Delete address
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium text-zinc-900">
                    {address.recipient_name || "Recipient name not set"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{line || "Address details are incomplete."}</p>

                  <div className="mt-5 flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSuccess(null);
                        setAddressDraft(toAddressDraft(address));
                        setAddressEditorMode("edit");
                        setOpenMenuId(null);
                      }}
                      disabled={actionsDisabled}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
            <p className="text-base font-semibold text-zinc-900">No saved addresses yet</p>
            <p className="mt-2 text-sm text-zinc-600">
              Add your first address using the <span className="font-medium text-zinc-900">Add new address</span> button above.
            </p>
          </div>
        )}

        {addressEditorMode ? (
          <div className="mt-7 rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">
                {addressEditorMode === "add" ? "Add new address" : "Edit address"}
              </p>
              <button
                type="button"
                onClick={() => setAddressEditorMode(null)}
                disabled={saving}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-800">Label</span>
                <select
                  value={addressDraft.label}
                  onChange={(event) =>
                    setAddressDraft((draft) => ({ ...draft, label: event.target.value as AddressDraft["label"] }))
                  }
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Office">Office</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-800">Recipient name</span>
                <input
                  value={addressDraft.recipient_name}
                  onChange={(event) => setAddressDraft((draft) => ({ ...draft, recipient_name: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200"
                  placeholder="Name receiving this order"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-800">State / region</span>
                <select
                  value={addressDraft.state}
                  onChange={(event) => setAddressDraft((draft) => ({ ...draft, state: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="">Select state / region</option>
                  {REGIONS_MY.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-zinc-800">Address line 1</span>
                <input
                  value={addressDraft.address_line1}
                  onChange={(event) => setAddressDraft((draft) => ({ ...draft, address_line1: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200"
                  placeholder="Street, building, unit"
                />
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-zinc-800">Address line 2</span>
                <input
                  value={addressDraft.address_line2}
                  onChange={(event) => setAddressDraft((draft) => ({ ...draft, address_line2: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200"
                  placeholder="Apartment, floor (optional)"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-800">City</span>
                <input
                  value={addressDraft.city}
                  onChange={(event) => setAddressDraft((draft) => ({ ...draft, city: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200"
                  placeholder="City"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-800">Postal code</span>
                <input
                  value={addressDraft.postal_code}
                  onChange={(event) => setAddressDraft((draft) => ({ ...draft, postal_code: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-700 focus:ring-2 focus:ring-zinc-200"
                  placeholder="Postcode"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-800">Country</span>
                <input
                  value="Malaysia"
                  readOnly
                  aria-readonly="true"
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                />
              </label>

              {showDefaultShippingToggle ? (
                <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={addressDraft.set_default_shipping}
                    onChange={(event) =>
                      setAddressDraft((draft) => ({ ...draft, set_default_shipping: event.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-300"
                  />
                  <span className="text-sm text-zinc-700">Set as default shipping</span>
                </label>
              ) : null}

              <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={addressDraft.set_default_billing}
                  onChange={(event) =>
                    setAddressDraft((draft) => ({ ...draft, set_default_billing: event.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-300"
                />
                <span className="text-sm text-zinc-700">Set as default billing</span>
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void onSaveAddress()}
                disabled={saving}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : addressEditorMode === "add" ? "Add address" : "Save address"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {success}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
