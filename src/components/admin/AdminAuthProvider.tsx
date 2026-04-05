"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminProfile = {
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
};

type MeResponse = {
  username: string | null;
  email: string | null;
  id: string | null;
};

type AdminAuthContextValue = {
  user: null;
  profile: AdminProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/auth/me", { credentials: "include", cache: "no-store" });
        if (!active) return;

        if (!res.ok) {
          setProfile(null);
          if (res.status === 403) {
            router.replace("/admin/login?forbidden=1");
          } else if (res.status === 401 || res.status === 503) {
            router.replace("/admin/login");
          }
          return;
        }

        const data = (await res.json()) as MeResponse;
        setProfile({
          username: data.username,
          email: data.email,
          avatar_url: null,
          role: "admin",
        });
      } catch {
        if (active) {
          setProfile(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  const logout = async () => {
    setLoading(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    setProfile(null);
    setLoading(false);
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <AdminAuthContext.Provider value={{ user: null, profile, loading, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
