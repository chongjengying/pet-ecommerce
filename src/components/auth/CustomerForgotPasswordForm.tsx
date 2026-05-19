"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CustomerForgotPasswordForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!normalizedIdentifier) {
      setError("Please enter your email, username, or phone number.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: normalizedIdentifier }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

      if (!response.ok) {
        setError(payload.error || "Could not send reset OTP. Please try again.");
        return;
      }

      setMessage(
        payload.message || "If an account exists, we sent a reset OTP or link to your email/phone."
      );
      const nextIdentifier = encodeURIComponent(normalizedIdentifier);
      router.push(`/auth/reset-password?identifier=${nextIdentifier}`);
      router.refresh();
    } catch {
      setError("Could not send reset OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md">
      <div className="mb-6">
        <h2 className="text-[2.15rem] font-semibold tracking-tight text-[#10a5a0]">Reset your password</h2>
        <p className="mt-2 text-lg leading-relaxed text-umber/90">
          We will send an email / phone OTP to reset your password.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/90">Email Address / Username / Phone</span>
          <input
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Email Address / Phone Number"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-sm text-umber outline-none transition focus:border-sage"
            required
          />
        </label>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-[#18b4ad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#139f98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sending OTP..." : "Send OTP"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-umber/80">
        Already have account ?{" "}
        <Link href="/auth/login" className="font-medium text-[#1973e8] hover:underline">
          Login
        </Link>
      </p>
    </section>
  );
}
