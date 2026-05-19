"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const TOKEN_STORAGE_KEY = "customer_jwt_token";

type AuthUser = {
  username: string;
  email: string;
  fullName: string | null;
};

type LoginInput = { email: string; password: string };

type AuthContextValue = {
  loading: boolean;
  user: AuthUser | null;
  token: string | null;
  login: (input: LoginInput) => Promise<{ username: string; email: string; full_name: string | null }>;
  logout: (opts?: { redirect?: boolean }) => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  user: null,
  token: null,
  login: async () => {
    throw new Error("AuthProvider not mounted");
  },
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = async (currentToken: string) => {
    try {
      const res = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });
      if (!res.ok) throw new Error("Invalid token.");

      const payload = (await res.json().catch(() => ({}))) as {
        user?: { username: string; email: string; full_name: string | null };
      };
      if (!payload.user) throw new Error("Invalid profile data.");

      setUser({
        username: payload.user.username,
        email: payload.user.email,
        fullName: payload.user.full_name,
      });
      setToken(currentToken);
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
      setToken(null);
    }
  };

  useEffect(() => {
    const storedToken = typeof window !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    if (!storedToken) {
      setLoading(false);
      return;
    }
    void syncProfile(storedToken).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshFromStorage = () => {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setUser(null);
        setToken(null);
        return;
      }
      void syncProfile(storedToken);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_STORAGE_KEY) {
        refreshFromStorage();
      }
    };

    window.addEventListener("customer-auth-changed", refreshFromStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("customer-auth-changed", refreshFromStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = async ({ email, password }: LoginInput) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: { username: string; email: string; full_name: string | null };
      error?: string;
    };
    if (!res.ok || !payload.token || !payload.user) {
      throw new Error(payload.error || "Unable to authenticate.");
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
    setUser({
      username: payload.user.username,
      email: payload.user.email,
      fullName: payload.user.full_name,
    });
    setToken(payload.token);
    return payload.user;
  };

  const logout = ({ redirect = true }: { redirect?: boolean } = {}) => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("customer-auth-changed"));
    }
    if (redirect) {
      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
    }
  };

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      token,
      login,
      logout,
      isAuthenticated: Boolean(user && token),
    }),
    [loading, user, token]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
