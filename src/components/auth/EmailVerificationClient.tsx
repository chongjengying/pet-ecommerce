"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { setAuthFlash } from "@/lib/authFlash";

type VerifyState = "verifying" | "success" | "error";
type ResendTone = "success" | "error" | "info";

export default function EmailVerificationClient() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const seededEmail = useMemo(() => searchParams.get("email")?.trim().toLowerCase() ?? "", [searchParams]);
  const hasToken = token.length > 0;

  const [state, setState] = useState<VerifyState>(hasToken ? "verifying" : "error");
  const [message, setMessage] = useState(
    hasToken ? "Verifying your email..." : "Finish verification to activate your account."
  );
  const [email, setEmail] = useState(seededEmail);
  const [editingEmail, setEditingEmail] = useState(!seededEmail);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendTone, setResendTone] = useState<ResendTone>("info");
  const [resendBlockedUntil, setResendBlockedUntil] = useState(0);

  useEffect(() => {
    if (!token) return;

    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/auth/verification/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email: seededEmail }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !payload.success) {
          setState("error");
          setMessage(payload.error || "Verification failed. Request a new verification email.");
          return;
        }
        setState("success");
        setMessage(payload.message || "Email verified successfully.");
        setAuthFlash("Email verified successfully. You can now sign in.", "success");
        window.dispatchEvent(new Event("customer-auth-changed"));
      } catch {
        if (!active) return;
        setState("error");
        setMessage("Verification failed due to network error. Please try again.");
      }
    })();

    return () => {
      active = false;
    };
  }, [token, seededEmail]);

  useEffect(() => {
    if (resendBlockedUntil <= Date.now()) return;
    const msUntilUnblock = resendBlockedUntil - Date.now();
    const timer = window.setTimeout(() => {
      setResendBlockedUntil(0);
    }, msUntilUnblock);
    return () => window.clearTimeout(timer);
  }, [resendBlockedUntil]);

  const onResend = async () => {
    if (resendBlockedUntil > Date.now()) {
      setResendTone("error");
      setResendMessage("You've requested verification too many times. Please wait a few minutes before trying again.");
      return;
    }

    setResendTone("info");
    setResendMessage(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setResendTone("error");
      setResendMessage("Enter your email to resend the verification link.");
      return;
    }

    setResendLoading(true);
    setResendTone("info");
    setResendMessage("Loading... Sending verification email.");
    try {
      const response = await fetch("/api/auth/verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
        retryAfterSeconds?: number;
      };
      if (!response.ok || !payload.success) {
        if (response.status === 429) {
          const retryAfterSeconds =
            typeof payload.retryAfterSeconds === "number" ? Math.max(1, payload.retryAfterSeconds) : 300;
          setResendBlockedUntil(Date.now() + retryAfterSeconds * 1000);
          setResendTone("error");
          setResendMessage("You've requested verification too many times. Please wait a few minutes before trying again.");
          return;
        }
        setResendTone("error");
        setResendMessage(payload.error || "Could not resend verification email.");
        return;
      }

      setResendTone("success");
      setResendMessage(payload.message || "Please go to your email and verify your email address.");
    } catch {
      setResendTone("error");
      setResendMessage("Could not resend verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  if (hasToken) {
    if (state === "success") {
      return (
        <section className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-amber-200/60 bg-white/90 shadow-[0_18px_55px_rgba(44,36,32,0.08)] backdrop-blur">
          <div className="flex flex-col items-center px-7 pt-9 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-amber-200 bg-cream text-amber-700 shadow-sm">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 7V6a5 5 0 0 1 10 0v1m-12 2h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9Zm7 9.2s-2.6-1.6-2.6-3.3a1.7 1.7 0 0 1 3-1.1a1.7 1.7 0 0 1 3 1.1c0 1.7-2.6 3.3-2.6 3.3Z"
                />
              </svg>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-umber/60">Pawluxe</p>
            <p className="-mt-0.5 text-sm font-semibold tracking-[0.22em] text-umber">PAWLUXE</p>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-umber">Email verified</h1>
            <p className="mt-2 text-sm text-umber/70">
              Your email has been successfully confirmed. You can now continue.
            </p>
          </div>

          <div className="px-7 pb-8 pt-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-900/90">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
                    <path
                      fill="currentColor"
                      d="M10 18a8 8 0 1 1 0-16a8 8 0 0 1 0 16Zm3.53-9.47a.75.75 0 0 0-1.06-1.06L9.25 10.69L7.53 8.97a.75.75 0 0 0-1.06 1.06l2.25 2.25c.3.3.77.3 1.06 0l3.75-3.75Z"
                    />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-emerald-900">Success</p>
                  <p className="mt-0.5 text-emerald-900/75">{message || "Your email is verified."}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-2xl bg-umber px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-umber/90"
              >
                Go to login
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-umber transition hover:bg-amber-50"
              >
                Back to home
              </Link>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="mx-auto w-full max-w-md rounded-3xl border border-amber-200/70 bg-white/90 p-7 shadow-[0_18px_55px_rgba(44,36,32,0.08)] backdrop-blur">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">Pawluxe Customer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-umber">Email verification</h1>
        </div>

        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            state === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {message}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/auth/login"
            className="inline-flex min-h-[42px] items-center justify-center rounded-2xl bg-umber px-4 py-2.5 text-sm font-semibold text-white hover:bg-umber/90"
          >
            Go to login
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-umber hover:bg-amber-50"
          >
            Back to home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-amber-200/70 bg-white/90 shadow-[0_18px_55px_rgba(44,36,32,0.08)] backdrop-blur">
      <div className="flex flex-col items-center px-7 pt-9 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-amber-200 bg-cream text-amber-700 shadow-sm">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 7V6a5 5 0 0 1 10 0v1m-12 2h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9Zm7 9.2s-2.6-1.6-2.6-3.3a1.7 1.7 0 0 1 3-1.1a1.7 1.7 0 0 1 3 1.1c0 1.7-2.6 3.3-2.6 3.3Z"
            />
          </svg>
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-umber">Verify your email</h1>
        {seededEmail ? (
          <>
            <p className="mt-3 text-sm text-umber/70">We&apos;ve sent a verification link to:</p>
            <p className="mt-1 text-base font-semibold text-umber">{seededEmail}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-umber/70">{message}</p>
        )}
      </div>

      <div className="px-7 pb-7 pt-6">
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={resendLoading || resendBlockedUntil > Date.now()}
          aria-busy={resendLoading}
          className="inline-flex w-full min-h-[46px] items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resendLoading ? "Loading..." : "Resend email"}
        </button>

        <div className="mt-6 border-t border-amber-200/70 pt-6">
          <h2 className="text-left text-base font-semibold text-umber">Didn&apos;t get it?</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-umber/80">
            <li>Check your spam folder</li>
            <li>Wait a few minutes</li>
            <li>Make sure the email is correct</li>
          </ul>

          <div className="mt-4">
            {editingEmail ? (
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
            ) : (
              <button
                type="button"
                onClick={() => setEditingEmail(true)}
                className="text-sm font-semibold text-amber-700 underline decoration-amber-300 underline-offset-4 hover:text-amber-800"
              >
                Edit email
              </button>
            )}
          </div>
        </div>

        {resendMessage ? (
          <p
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              resendTone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : resendTone === "info"
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {resendMessage}
          </p>
        ) : null}

        <div className="mt-7 border-t border-amber-200/70 pt-5 text-center text-sm text-umber/70">
          <span>Already verified? </span>
          <Link href="/auth/login" className="font-semibold text-amber-700 hover:text-amber-800">
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}
