"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AdminProfile = {
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
};

type AdminAuthContextValue = {
  user: User | null;
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

function normalizeProfileRow(row: Record<string, unknown>, user: User): AdminProfile {
  const profileEmail = typeof row.email === "string" ? row.email : null;
  return {
    username: typeof row.username === "string" ? row.username : null,
    email: profileEmail ?? user.email ?? null,
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    role: typeof row.role === "string" ? row.role : null,
  };
}

async function fetchProfileForUser(user: User): Promise<AdminProfile | null> {
  const byId = await supabase
    .from("profiles")
    .select("username, email, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!byId.error && byId.data) {
    return normalizeProfileRow(byId.data as Record<string, unknown>, user);
  }

  const byUserId = await supabase
    .from("profiles")
    .select("username, email, avatar_url, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!byUserId.error && byUserId.data) {
    return normalizeProfileRow(byUserId.data as Record<string, unknown>, user);
  }

  return {
    username: user.email?.split("@")[0] ?? null,
    email: user.email ?? null,
    avatar_url: null,
    role: null,
  };
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedUserIdRef = useRef<string | null>(null);
  const fetchingUserIdRef = useRef<string | null>(null);
  const profileRef = useRef<AdminProfile | null>(null);

  useEffect(() => {
    let active = true;

    const syncProfile = async (nextUser: User | null) => {
      if (!active) return;
      if (!nextUser) {
        fetchedUserIdRef.current = null;
        fetchingUserIdRef.current = null;
        setUser(null);
        setProfile(null);
        profileRef.current = null;
        setLoading(false);
        return;
      }

      setUser(nextUser);
      if (fetchedUserIdRef.current === nextUser.id && profileRef.current) {
        setLoading(false);
        return;
      }
      if (fetchingUserIdRef.current === nextUser.id) {
        return;
      }

      fetchingUserIdRef.current = nextUser.id;
      setLoading(true);
      try {
        const nextProfile = await fetchProfileForUser(nextUser);
        if (!active) return;
        fetchedUserIdRef.current = nextUser.id;
        setProfile(nextProfile);
        profileRef.current = nextProfile;
        setLoading(false);
      } finally {
        fetchingUserIdRef.current = null;
      }
    };

    const bootstrap = async () => {
      const { data } = await supabase.auth.getUser();
      await syncProfile(data.user ?? null);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncProfile(session?.user ?? null);
    });

    return () => {
      active = false;
      fetchingUserIdRef.current = null;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // No-op: local UI state still clears even if API call fails.
    }
    setUser(null);
    setProfile(null);
    profileRef.current = null;
    fetchedUserIdRef.current = null;
    fetchingUserIdRef.current = null;
    const localKeys = Object.keys(localStorage);
    for (const key of localKeys) {
      if (key.startsWith("sb-")) localStorage.removeItem(key);
    }
    const sessionKeys = Object.keys(sessionStorage);
    for (const key of sessionKeys) {
      if (key.startsWith("sb-")) sessionStorage.removeItem(key);
    }
    setLoading(false);
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        profile,
        loading,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
