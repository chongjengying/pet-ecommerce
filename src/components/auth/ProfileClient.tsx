"use client";

import { useEffect, useState } from "react";
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
  avatar_url?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  addresses?: ProfileAddress[];
};

function defaultShippingAddress(user: ProfileUser): ProfileAddress | null {
  if (!user.addresses?.length) return null;
  return user.addresses.find((a) => a.is_default) ?? user.addresses[0] ?? null;
}

function normalizeGender(value: string | null | undefined): "" | "male" | "female" {
  return value === "male" || value === "female" ? value : "";
}

function normalizeAddressLabel(value: string | null | undefined): "Home" | "Work" | "Office" {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "work") return "Work";
  if (v === "office") return "Office";
  return "Home";
}

/** Show username without a leading @ (handles legacy data that includes @). */
function displayUsername(raw: string | undefined | null): string {
  if (raw == null || String(raw).trim() === "") return "—";
  return String(raw).trim().replace(/^@+/, "");
}

export default function ProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetupFlow = searchParams.get("setup") === "1";
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    let active = true;
    const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
    const cached = readProfileCache(token);
    let hydratedFromCache = false;
    if (cached) {
      hydratedFromCache = true;
      setUser(cached);
      setLoading(false);
    }

    const loadUser = async () => {
      try {
        setError(null);
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
          const token2 = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
          const meRes = await fetch("/api/auth/me", {
            method: "GET",
            headers: {
              ...(token2 ? { Authorization: `Bearer ${token2}` } : {}),
            },
          });
          if (!active) return;
          if (meRes.ok) {
            const mePayload = (await meRes.json().catch(() => ({}))) as { user?: Partial<ProfileUser> };
            if (mePayload.user?.email && mePayload.user?.username) {
              const partial: ProfileUser = {
                id: String(mePayload.user.id ?? ""),
                email: String(mePayload.user.email),
                username: String(mePayload.user.username),
                full_name: mePayload.user.full_name ?? null,
                avatar_url: null,
                phone: null,
                gender: null,
                dob: null,
              };
              setUser(partial);
              if (token2) writeProfileCache(token2, partial);
              setNotice("Profile details are not fully available yet. Please complete setup and save your profile.");
              return;
            }
          }
          const failure = (await res.json().catch(() => ({}))) as { error?: string };
          if (!hydratedFromCache) {
            setError(failure.error || "Could not load profile.");
          }
          return;
        }

        const payload = (await res.json().catch(() => ({}))) as { user?: ProfileUser };
        if (!payload.user) {
          router.replace("/auth/login?next=/profile");
          return;
        }

        setNotice(null);
        setUser(payload.user);
        if (token) writeProfileCache(token, payload.user);
      } catch {
        if (!active) return;
        if (!hydratedFromCache) {
          setError("Could not load profile.");
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
  }, [router]);

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
      address_label: formData.get("address_label")?.toString() ?? "",
      address_line1: formData.get("address_line1")?.toString() ?? "",
      address_line2: formData.get("address_line2")?.toString() ?? "",
      address_city: formData.get("address_city")?.toString() ?? "",
      address_state: formData.get("address_state")?.toString() ?? "",
      address_postal_code: formData.get("address_postal_code")?.toString() ?? "",
      address_country: formData.get("address_country")?.toString() ?? "",
    };

    const need = (v: string) => v.trim().length > 0;
    if (
      !need(payload.address_line1) ||
      !need(payload.address_city) ||
      !need(payload.address_state) ||
      !need(payload.address_postal_code) ||
      !need(payload.address_country)
    ) {
      setError("Shipping address is required: line 1, city, state, postal code, and country.");
      setSaving(false);
      return;
    }

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
        return;
      }

      setNotice(null);
      setUser(data.user);
      if (token) writeProfileCache(token, data.user);
      setFormKey((k) => k + 1);
      setSuccess("Changes saved.");
    } catch {
      setError("Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

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

  const userHandle = displayUsername(user.username);
  const greetingName = user.full_name?.trim() || userHandle;
  const initials = getAvatarInitials(user.full_name, user.username.replace(/^@+/, ""));
  const ship = defaultShippingAddress(user);
  const selectedGender = normalizeGender(user.gender);
  const selectedAddressLabel = normalizeAddressLabel(ship?.label);

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-[0_12px_40px_rgba(44,36,32,0.06)]">
      {/* Header */}
      <div className="border-b border-amber-100/90 bg-gradient-to-br from-white via-cream to-amber-50/40 px-6 py-8 sm:px-10 sm:py-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <UserAvatar src={user.avatar_url} alt={greetingName} initials={initials} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-umber/45">Your profile</p>
            <h1 className="text-2xl font-semibold tracking-tight text-umber sm:text-3xl">Hi, {greetingName}</h1>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-umber/65">
              <div className="flex items-baseline gap-2">
                <dt className="text-umber/45">Username</dt>
                <dd className="font-medium text-umber">{userHandle}</dd>
              </div>
            </dl>
          </div>
        </div>
        {isSetupFlow ? (
          <p className="mt-6 rounded-xl border border-amber-200/80 bg-white/90 px-4 py-3 text-sm leading-relaxed text-amber-950/90">
            Complete your details and a full shipping address below, then save. You need this address to check out.
          </p>
        ) : null}
      </div>

      <form
        key={formKey}
        className="px-6 py-8 sm:px-10 sm:py-9"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          void onSave(fd);
        }}
      >
        {/* Account (read-only) */}
        <section aria-labelledby="account-heading" className="pb-8">
          <h2 id="account-heading" className="text-sm font-semibold text-umber">
            Account
          </h2>
          <p className="mt-1 text-xs text-umber/55">These fields cannot be changed here.</p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-100/90 bg-cream/40 px-4 py-3.5">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-umber/45">Email</dt>
              <dd className="mt-1.5 break-all text-sm font-medium text-umber">{user.email || "—"}</dd>
            </div>
            <div className="rounded-xl border border-amber-100/90 bg-cream/40 px-4 py-3.5">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-umber/45">Username</dt>
              <dd className="mt-1.5 text-sm font-medium text-umber">{userHandle}</dd>
            </div>
          </dl>
        </section>

        <div className="border-t border-amber-100/90" />

        {/* Editable */}
        <section aria-labelledby="details-heading" className="pt-8">
          <h2 id="details-heading" className="text-sm font-semibold text-umber">
            Personal details
          </h2>
          <p className="mt-1 text-xs text-umber/55">Update your information anytime.</p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Full name</span>
              <input
                name="full_name"
                defaultValue={user.full_name ?? ""}
                autoComplete="name"
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="Your name"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Phone</span>
              <input
                name="phone"
                defaultValue={user.phone ?? ""}
                autoComplete="tel"
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="+60 12 345 6789"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Gender</span>
              <select
                name="gender"
                defaultValue={selectedGender}
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
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
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
              />
            </label>
          </div>
        </section>

        <div className="border-t border-amber-100/90" />

        <section aria-labelledby="address-heading" className="pt-8">
          <h2 id="address-heading" className="text-sm font-semibold text-umber">
            Shipping address
            <span className="ml-1 font-normal text-red-600">*</span>
          </h2>
          <p className="mt-1 text-xs text-umber/55">
            Required for checkout. Line 2 and label are optional; all other fields must be filled.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Address label</span>
              <select
                name="address_label"
                defaultValue={selectedAddressLabel}
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
              >
                <option value="Home">Home</option>
                <option value="Work">Work</option>
                <option value="Office">Office</option>
              </select>
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-umber/90">Address line 1</span>
              <input
                name="address_line1"
                defaultValue={ship?.line1 ?? ""}
                autoComplete="address-line1"
                required
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="Street, building, unit"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-umber/90">Address line 2</span>
              <input
                name="address_line2"
                defaultValue={ship?.line2 ?? ""}
                autoComplete="address-line2"
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="Apartment, floor (optional)"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">City</span>
              <input
                name="address_city"
                defaultValue={ship?.city ?? ""}
                autoComplete="address-level2"
                required
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="City"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">State / region</span>
              <input
                name="address_state"
                defaultValue={ship?.state ?? ""}
                autoComplete="address-level1"
                required
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="State"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Postal code</span>
              <input
                name="address_postal_code"
                defaultValue={ship?.postal_code ?? ""}
                autoComplete="postal-code"
                required
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="Postcode"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-umber/90">Country</span>
              <input
                name="address_country"
                defaultValue={ship?.country ?? "MY"}
                autoComplete="country-name"
                required
                className="w-full rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition placeholder:text-umber/35 focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                placeholder="MY"
              />
            </label>
          </div>
        </section>

        {error ? (
          <p
            className="mt-6 rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-6 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
            {success}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-6 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            {notice}
          </p>
        ) : null}

        <div className="mt-10 flex flex-col gap-3 border-t border-amber-100/90 pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-umber px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-umber/92 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/products")}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-200/90 bg-white px-6 py-2.5 text-sm font-semibold text-umber shadow-sm transition hover:bg-amber-50/80"
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
