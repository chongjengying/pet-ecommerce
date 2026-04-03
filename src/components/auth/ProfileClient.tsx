"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ProfileUser = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
};

function getInitials(source: string): string {
  const parts = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  if (parts.length > 0 && parts.some(Boolean)) return parts.join("");
  return source.charAt(0).toUpperCase();
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

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      try {
        setError(null);
        const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
        const res = await fetch("/api/profile", {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!active) return;

        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/auth/login?next=/profile");
            return;
          }
          const token = typeof window !== "undefined" ? localStorage.getItem("customer_jwt_token") : null;
          const meRes = await fetch("/api/auth/me", {
            method: "GET",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (!active) return;
          if (meRes.ok) {
            const mePayload = (await meRes.json().catch(() => ({}))) as { user?: Partial<ProfileUser> };
            if (mePayload.user?.email && mePayload.user?.username) {
              setUser({
                id: String(mePayload.user.id ?? ""),
                email: String(mePayload.user.email),
                username: String(mePayload.user.username),
                full_name: mePayload.user.full_name ?? null,
                avatar_url: null,
                phone: null,
                gender: null,
                dob: null,
              });
              setNotice("Profile details are not fully available yet. Please complete setup and save your profile.");
              return;
            }
          }
          const failure = (await res.json().catch(() => ({}))) as { error?: string };
          setError(failure.error || "Could not load profile.");
          return;
        }

        const payload = (await res.json().catch(() => ({}))) as { user?: ProfileUser };
        if (!payload.user) {
          router.replace("/auth/login?next=/profile");
          return;
        }

        setNotice(null);
        setUser(payload.user);
      } catch {
        if (!active) return;
        setError("Could not load profile.");
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

    const payload = {
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
      setSuccess("Profile updated");
    } catch {
      setError("Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-amber-200/70 bg-white p-8 shadow-sm">
        <p className="text-sm text-umber/70">Loading your profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-red-700">{error || "Could not load profile details."}</p>
      </div>
    );
  }

  const displayName = user?.full_name?.trim() || user?.username || "there";
  const initials = user ? getInitials(user.full_name || user.username || "P") : "P";

  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200/70 bg-white shadow-[0_18px_45px_rgba(44,36,32,0.08)]">
      <div className="bg-gradient-to-r from-amber-50 via-cream to-emerald-50 px-6 py-7 sm:px-8">
        <div className="flex items-center gap-4">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={displayName}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-umber/10 text-2xl font-semibold text-umber ring-2 ring-white">
              {initials}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">Customer Profile</p>
            <h1 className="mt-1 text-3xl font-semibold text-umber">Hi {displayName}</h1>
            <p className="text-sm text-umber/70">@{user?.username}</p>
          </div>
        </div>
        {isSetupFlow ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-white/80 px-4 py-2 text-sm text-amber-900">
            Complete your details and click Save changes to finish account setup.
          </p>
        ) : null}
      </div>

      <form
        className="space-y-6 border-t border-amber-100 px-6 py-6 sm:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          void onSave(fd);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-amber-100 bg-cream/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-umber/60">Email</p>
            <p className="mt-2 text-sm font-medium text-umber">{user?.email || "No email on file"}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-cream/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-umber/60">Username</p>
            <p className="mt-2 text-sm font-medium text-umber">@{user?.username}</p>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-umber/70">Personal details</h2>
          <p className="mt-1 text-xs text-umber/60">Avatar image URL is managed in the database/storage pipeline.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-umber">Full name</span>
            <input
              name="full_name"
              defaultValue={user?.full_name ?? ""}
              className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
              placeholder="Jane Pawson"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-umber">Phone</span>
            <input
              name="phone"
              defaultValue={user?.phone ?? ""}
              className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
              placeholder="+60 12 345 6789"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-umber">Gender</span>
            <select
              name="gender"
              defaultValue={user?.gender ?? ""}
              className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-2 sm:col-span-2 sm:max-w-xs">
            <span className="text-sm font-semibold text-umber">Date of birth</span>
            <input
              type="date"
              name="dob"
              defaultValue={user?.dob ?? ""}
              className="w-full rounded-2xl border border-amber-200/80 bg-white px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
            />
          </label>
        </div>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {success ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
        ) : null}
        {notice ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-umber px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-umber/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-umber transition hover:bg-amber-50"
          >
            Continue Shopping
          </button>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-umber transition hover:bg-amber-50"
          >
            Sign out
          </button>
        </div>
      </form>
    </section>
  );
}
