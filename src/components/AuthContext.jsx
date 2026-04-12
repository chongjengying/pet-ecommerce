"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const TOKEN_STORAGE_KEY = "customer_jwt_token";

const AuthContext = createContext({
  loading: true,
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = async (currentToken) => {
    try {
      const res = await fetch("/profile", {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });
      if (!res.ok) throw new Error("Invalid token.");
      const payload = (await res.json().catch(() => ({}))) as { user?: { username: string; email: string; full_name: string | null } };
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

  const login = async ({ email, password }) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await res.json().catch(() => ({}))) as { token?: string; user?: { username: string; email: string; full_name: string | null } };
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

  const logout = ({ redirect = true } = {}) => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setToken(null);
    if (redirect) {
      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
    }
  };

  const contextValue = useMemo(
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
