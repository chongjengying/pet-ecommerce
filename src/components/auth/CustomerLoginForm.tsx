"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { clearProfileCache } from "@/lib/profileCache";

export default function CustomerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!normalizedIdentifier || !password) {
      setError("Please enter your username/email and password.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: normalizedIdentifier, password }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
      if (!res.ok) {
        setError(payload.error || "Login failed. Please try again.");
        return;
      }

      if (payload.token) {
        clearProfileCache();
        localStorage.setItem("customer_jwt_token", payload.token);
        window.dispatchEvent(new Event("customer-auth-changed"));
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-amber-200/70 bg-white/90 p-7 shadow-[0_18px_55px_rgba(44,36,32,0.08)] backdrop-blur">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">Pawluxe Customer</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-umber">Welcome back</h1>
        <p className="mt-2 text-sm text-umber/70">Sign in to track orders, save favorites, and check out faster.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/85">Username or Email</span>
          <input
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="janedoe or you@example.com"
            className="w-full rounded-2xl border border-amber-200/80 bg-cream px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/85">Password</span>
          <div className="flex items-center rounded-2xl border border-amber-200/80 bg-cream px-3 focus-within:border-sage focus-within:bg-white">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full bg-transparent py-3 text-sm text-umber outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="ml-2 rounded-lg px-2 py-1 text-xs font-medium text-umber/70 hover:bg-amber-100"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-umber px-4 py-3 text-sm font-semibold text-white transition hover:bg-umber/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-umber/70">
        New customer?{" "}
        <Link href="/auth/signup" className="font-semibold text-terracotta hover:underline">
          Create account
        </Link>
      </p>
    </section>
  );
}
