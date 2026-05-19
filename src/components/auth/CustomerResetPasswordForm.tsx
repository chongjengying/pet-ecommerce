"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RuleChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        active ? "bg-[#9edb82] text-white" : "bg-stone-200 text-stone-600"
      }`}
    >
      {label}
    </span>
  );
}

export default function CustomerResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identifier = searchParams.get("identifier") ?? "";

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message] = useState("SUCCESS: We have sent verification code to your mail, use that code and change password");
  const [bannerVisible, setBannerVisible] = useState(true);

  const rules = useMemo(
    () => ({
      minLength: newPassword.length >= 8,
      digit: /\d/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
      upper: /[A-Z]/.test(newPassword),
    }),
    [newPassword]
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!otp.trim()) {
      setError("Please enter the OTP.");
      setLoading(false);
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      setLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier || undefined,
          otp: otp.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

      if (!response.ok) {
        setError(payload.error || "Could not reset password.");
        return;
      }

      router.replace("/auth/login?reset=success");
      router.refresh();
    } catch {
      setError("Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md">
      {bannerVisible && message ? (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-sm bg-[#14a8a2] px-4 py-3 text-white">
          <p className="text-sm font-medium">{message}</p>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setBannerVisible(false)}
            className="mt-0.5 text-lg leading-none text-white/90 hover:text-white"
          >
            x
          </button>
        </div>
      ) : null}

      <div className="mb-5">
        <h2 className="text-[2.15rem] font-semibold tracking-tight text-[#10a5a0]">Change Password</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/90">Verify OTP</span>
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="207946"
            className="w-full rounded border border-stone-300 bg-white px-3 py-2.5 text-sm text-umber outline-none transition focus:border-sage"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/90">New Password</span>
          <div className="flex items-center rounded border border-stone-300 bg-white px-3 focus-within:border-sage">
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter new password"
              className="w-full bg-transparent py-2.5 text-sm text-umber outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="ml-2 rounded px-1 text-xs text-umber/70 hover:bg-stone-100"
            >
              {showNewPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap gap-1.5">
          <RuleChip label="8 characters" active={rules.minLength} />
          <RuleChip label="1 digit" active={rules.digit} />
          <RuleChip label="1 special letter" active={rules.special} />
          <RuleChip label="1 upper case" active={rules.upper} />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-umber/90">Confirm New Password</span>
          <div className="flex items-center rounded border border-stone-300 bg-white px-3 focus-within:border-sage">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
              className="w-full bg-transparent py-2.5 text-sm text-umber outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="ml-2 rounded px-1 text-xs text-umber/70 hover:bg-stone-100"
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-[#18b4ad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#139f98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Changing Password..." : "Change Password"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-umber/80">
        Already Have Account ?{" "}
        <Link href="/auth/login" className="font-medium text-[#1973e8] hover:underline">
          Login
        </Link>
      </p>
    </section>
  );
}
