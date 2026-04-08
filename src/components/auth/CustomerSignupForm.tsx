"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearProfileCache } from "@/lib/profileCache";

export default function CustomerSignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedFullName = fullName.trim();

    if (!trimmedFullName || trimmedFullName.length < 2) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }
    if (!normalizedEmail || !trimmedUsername || password.length < 6) {
      setError("Use a valid email, username, and a password with at least 6 characters.");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please check and try again.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          email: normalizedEmail,
          password,
          confirmPassword,
          fullName: trimmedFullName,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; token?: string };

      if (!res.ok) {
        setError(payload.error || "Sign up failed. Please try again.");
        return;
      }

      if (payload.token) {
        clearProfileCache();
        localStorage.setItem("customer_jwt_token", payload.token);
        window.dispatchEvent(new Event("customer-auth-changed"));
      }

      setMessage("Account created. Add your shipping address on your profile next.");
      router.replace("/profile?setup=1");
      router.refresh();
    } catch {
      setError("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-amber-200/70 bg-white/90 p-7 shadow-[0_18px_55px_rgba(44,36,32,0.08)] backdrop-blur">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">Pawluxe Customer</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-umber">Create account</h1>
        <p className="mt-2 text-sm text-umber/70">
          View order history and check out after you add a shipping address on your profile.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/85">Username</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="janedoe"
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9._-]{3,30}"
            title="3-30 characters: letters, numbers, . _ -"
            className="w-full rounded-2xl border border-amber-200/80 bg-cream px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/85">Full name</span>
          <input
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jane Pawson"
            minLength={2}
            className="w-full rounded-2xl border border-amber-200/80 bg-cream px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/85">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-amber-200/80 bg-cream px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/85">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            className="w-full rounded-2xl border border-amber-200/80 bg-cream px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/85">Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            minLength={6}
            className="w-full rounded-2xl border border-amber-200/80 bg-cream px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage focus:bg-white"
            required
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-umber px-4 py-3 text-sm font-semibold text-white transition hover:bg-umber/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-umber/70">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-semibold text-terracotta hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
