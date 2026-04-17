"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearProfileCache,
  readProfileCache,
  writeProfileCache,
  type ProfileAddress,
} from "@/lib/profileCache";
import { setAuthFlash } from "@/lib/authFlash";
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

function defaultShippingAddress(user: ProfileUser): ProfileAddress | null {
  if (!user.addresses?.length) return null;
  return (
    user.addresses.find((address) => address.is_default_shipping ?? address.is_default) ??
    user.addresses[0] ??
    null
  );
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

function countSavedAddresses(user: ProfileUser | null): number {
  return user?.addresses?.length ?? 0;
}

function statusTone(complete: boolean): string {
  return complete
    ? "border-emerald-200/90 bg-emerald-50 text-emerald-900"
    : "border-amber-200/90 bg-amber-50 text-amber-950";
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
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

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
    setAuthFlash("Signed out successfully.", "success");
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
      setFormKey((current) => current + 1);
      setSuccess("Profile updated.");
      if (token) {
        writeProfileCache(token, data.user);
      }
    } catch {
      setError("Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Current, new, and confirm password are required.");
      setPasswordSuccess(null);
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok || !data.success) {
        setPasswordError(data.error || "Could not update password.");
        return;
      }

      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Could not update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const userHandle = displayUsername(user?.username);
  const greetingName = user?.full_name?.trim() || userHandle;
  const initials = getAvatarInitials(user?.full_name ?? null, user?.username?.replace(/^@+/, "") ?? "");
  const shippingAddress = user ? defaultShippingAddress(user) : null;
  const selectedGender = normalizeGender(user?.gender);
  const selectedAddressLabel = normalizeAddressLabel(shippingAddress?.label);
  const savedAddressCount = countSavedAddresses(user);
  const liveAddressPreview = [
    selectedAddressLabel,
    shippingAddress?.recipient_name ?? "",
    shippingAddress?.address_line1 ?? "",
    shippingAddress?.city ?? "",
    shippingAddress?.state ?? "",
    shippingAddress?.postal_code ?? "",
    shippingAddress?.country ?? "",
  ]
    .filter((value) => hasValue(value))
    .join(", ");

  const readiness = useMemo(() => {
    if (!user) {
      return {
        addressSummary: "No profile loaded yet.",
        checkoutReady: false,
        contactReady: false,
      };
    }

    return {
      addressSummary: formatAddressSummary(shippingAddress),
      checkoutReady: hasCompleteShippingAddress(shippingAddress),
      contactReady: hasValue(user.full_name) && hasValue(user.phone),
    };
  }, [shippingAddress, user]);
  const heroChips = [
    { label: "Saved addresses", value: savedAddressCount.toString() },
    { label: "Checkout ready", value: readiness.checkoutReady ? "Yes" : "No" },
    { label: "Profile status", value: readiness.contactReady ? "Active" : "Needs update" },
  ];

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
              Update your account details here, then manage delivery and billing defaults from Address Book.
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

        <div className="mt-7 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Customer dashboard</p>
                <p className="mt-2 text-base font-semibold text-umber">A quick view of your account health</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(readiness.checkoutReady)}`}>
                {readiness.checkoutReady ? "Checkout ready" : "Needs address"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {heroChips.map((chip) => (
                <div key={chip.label} className="rounded-2xl border border-amber-100/90 bg-cream/55 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-umber/45">{chip.label}</p>
                  <p className="mt-1 text-sm font-semibold text-umber">{chip.value}</p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm leading-6 text-umber/62">
              Keep your profile details up to date so delivery, checkout, and order follow-up stay smooth.
            </p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_18px_40px_-24px_rgba(44,36,32,0.45)]">
            <div className="flex items-center justify-between border-b border-amber-100 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-umber/45">Pet image</p>
                <p className="mt-1 text-sm font-semibold text-umber">Pawluxe companion</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live</span>
            </div>
            <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_top,rgba(250,219,170,0.55),rgba(255,255,255,1)_58%)]">
              <Image
                src="/logo.png"
                alt="Pawluxe pet brand image"
                fill
                priority
                className="object-contain p-8"
              />
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
          <article className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Address book</p>
                <p className="mt-3 text-base font-semibold text-umber">
                  {savedAddressCount > 0 ? `${savedAddressCount} saved ${savedAddressCount === 1 ? "address" : "addresses"}` : "No saved addresses yet"}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(readiness.checkoutReady)}`}
              >
                {readiness.checkoutReady ? "Default address ready" : "Manage in Address Book"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-umber/62">
              {hasValue(liveAddressPreview) ? liveAddressPreview : readiness.addressSummary}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => router.push("/address-book")}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-amber-200/90 bg-white px-4 py-2 text-sm font-semibold text-umber transition hover:bg-amber-50"
              >
                Manage address book
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-umber/45">Source</p>
            <p className="mt-3 text-base font-semibold text-umber">Synced from your address records</p>
            <p className="mt-2 text-sm leading-6 text-umber/62">
              Your saved addresses are linked by user id. Add, edit, delete, and set defaults from the dedicated Address Book page.
            </p>
          </article>
        </div>

        {(isSetupFlow || !readiness.checkoutReady) && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200/85 bg-white/90 px-4 py-3 text-sm leading-relaxed text-amber-950/90 sm:flex-row sm:items-center sm:justify-between">
            <p>Complete your shipping details in Address Book to unlock faster checkout.</p>
            <button
              type="button"
              onClick={() => router.push("/address-book")}
              className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Open Address Book
            </button>
          </div>
        )}
      </div>

      <div className="px-6 py-8 sm:px-10 sm:py-9">
      <form
        key={formKey}
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
              className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(readiness.contactReady)}`}
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

        <section className="mt-10 border-t border-amber-100/90 pt-8">
          <h2 className="text-sm font-semibold text-umber">Change password</h2>
          <p className="mt-1 text-xs text-umber/55">Use your current password to set a new one.</p>
        </section>
      </form>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onChangePassword();
        }}
      >
        <section>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-umber/90">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-umber/90">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-umber/90">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-sm text-umber shadow-sm outline-none transition focus:border-sage/70 focus:ring-2 focus:ring-sage/20"
                required
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-umber px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-umber/92 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {passwordSaving ? "Updating..." : "Update password"}
              </button>
            </div>
          </div>

          {passwordError ? (
            <p className="mt-4 rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-800" role="alert">
              {passwordError}
            </p>
          ) : null}

          {passwordSuccess ? (
            <p className="mt-4 rounded-2xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
              {passwordSuccess}
            </p>
          ) : null}
        </section>
      </form>

        <section className="mt-10 border-t border-amber-100/90 pt-8">
          <h2 className="text-sm font-semibold text-umber">Address book</h2>
          <p className="mt-1 text-xs text-umber/55">This page shows a summary only. Manage all address changes in Address Book.</p>
          <div className="mt-4 rounded-2xl border border-amber-100/90 bg-cream/55 p-4">
            <p className="text-sm font-medium text-umber">
              {savedAddressCount > 0 ? `${savedAddressCount} address${savedAddressCount === 1 ? "" : "es"} available` : "No addresses saved yet"}
            </p>
            <p className="mt-2 text-sm leading-6 text-umber/62">
              {readiness.addressSummary}
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => router.push("/address-book")}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-amber-200/90 bg-white px-6 py-2.5 text-sm font-semibold text-umber shadow-sm transition hover:bg-amber-50/80"
              >
                Open Address Book
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-800" role="alert">
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
              onClick={() => router.push("/profile/orders")}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-amber-200/90 bg-white px-6 py-2.5 text-sm font-semibold text-umber shadow-sm transition hover:bg-amber-50/80"
            >
              Order status
            </button>
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
      </div>
    </div>
  );
}
