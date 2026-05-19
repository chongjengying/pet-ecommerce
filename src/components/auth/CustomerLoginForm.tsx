"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { clearProfileCache } from "@/lib/profileCache";
import { setAuthFlash } from "@/lib/authFlash";

function formatRetryAfter(seconds: number): string {
  const safeSeconds = Math.max(1, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  if (minutes <= 0) return `${remainder} seconds`;
  if (remainder === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${remainder} second${remainder === 1 ? "" : "s"}`;
}

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
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        token?: string;
        email?: string;
        remainingAttempts?: number;
        retryAfterSeconds?: number;
        temporarilyBlocked?: boolean;
        requiresEmailVerification?: boolean;
        user?: { isEmailVerified?: boolean; email?: string };
        emailVerification?: { message?: string };
      };
      if (!res.ok) {
        if (res.status === 403 && payload.requiresEmailVerification) {
          const pendingEmail = encodeURIComponent(payload.email || payload.user?.email || normalizedIdentifier);
          setAuthFlash(payload.emailVerification?.message || "Check your email to verify your account.", "info");
          router.replace(`/auth/verify-email?email=${pendingEmail}&source=login`);
          router.refresh();
          return;
        }
        if (payload.temporarilyBlocked && typeof payload.retryAfterSeconds === "number") {
          setError(`Too many failed attempts. Please wait ${formatRetryAfter(payload.retryAfterSeconds)} and try again.`);
          return;
        }
        if (res.status === 401 && typeof payload.remainingAttempts === "number") {
          setError(
            payload.remainingAttempts > 0
              ? `Wrong password or account. ${payload.remainingAttempts} attempt${payload.remainingAttempts === 1 ? "" : "s"} left before block.`
              : "Too many failed attempts. Account is temporarily blocked."
          );
          return;
        }
        setError(payload.error || "Login failed. Please try again.");
        return;
      }

      if (payload.token) {
        clearProfileCache();
        localStorage.setItem("customer_jwt_token", payload.token);
        window.dispatchEvent(new Event("customer-auth-changed"));
      }
      if (payload.user?.isEmailVerified === false) {
        setAuthFlash(payload.emailVerification?.message || "Check your email to verify your account.", "info");
      } else {
        setAuthFlash("Signed in successfully. Welcome back!", "success");
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
    <section className="mx-auto w-full max-w-md">
      <div className="mb-8 border-b border-stone-200">
        <div className="flex items-center gap-8">
          <p className="border-b-2 border-sage pb-3 text-lg font-semibold tracking-tight text-umber">Login</p>
          <Link href="/auth/signup" className="pb-3 text-lg font-medium text-umber/65 transition hover:text-umber">
            Sign Up
          </Link>
        </div>
      </div>

      <div className="mb-7">
        <h2 className="text-3xl font-semibold tracking-tight text-umber">Welcome back</h2>
        <p className="mt-2 text-sm text-umber/70">Use your email, username, or phone to sign in.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/90">Email Address / Username / Phone</span>
          <input
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="you@example.com or janedoe"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/90">Password</span>
          <div className="flex items-center rounded-xl border border-stone-300 bg-white px-3 focus-within:border-sage">
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
              className="ml-2 rounded-lg px-2 py-1 text-xs font-medium text-umber/70 hover:bg-stone-100"
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
          className="mt-2 w-full rounded-xl bg-[#18b4ad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#139f98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-umber/70">
        New customer?{" "}
        <Link href="/auth/signup" className="font-semibold text-[#1973e8] hover:underline">
          Create account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm">
        <Link href="/auth/forgot-password" className="font-medium text-[#1973e8] hover:underline">
          Forgot your password?
        </Link>
      </p>
    </section>
  );
}
