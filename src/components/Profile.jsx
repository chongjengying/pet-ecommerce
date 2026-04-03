"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

export default function Profile() {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch("/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          logout({ redirect: false });
          router.push("/auth/login");
          return;
        }
        const payload = (await res.json().catch(() => ({}))) as { user?: { username: string; email: string } };
        if (active && payload.user) {
          setProfile(payload.user);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchProfile();
    return () => {
      active = false;
    };
  }, [token, logout, router]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-amber-200/70 bg-white p-8 shadow-sm">
        <p className="text-sm text-umber/70">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-amber-200/70 bg-white p-8 shadow-lg">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">Customer Profile</p>
        <h1 className="text-3xl font-semibold text-umber">Hello, {profile.username}</h1>
        <p className="text-sm text-umber/70">Email: {profile.email}</p>
      </div>
    </section>
  );
}
