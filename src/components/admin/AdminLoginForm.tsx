"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { consumeAuthFlash, setAuthFlash } from "@/lib/authFlash";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/admin";
  const configMissing = searchParams.get("config") === "1";
  const forbidden = searchParams.get("forbidden") === "1";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const flash = consumeAuthFlash();
    if (flash && flash.tone === "success") {
      setSuccess(flash.message);
    }
  }, []);

  useEffect(() => {
    if (forbidden || configMissing) return;
    let active = true;
    void (async () => {
      const res = await fetch("/api/admin/auth/me", { credentials: "include", cache: "no-store" });
      if (!active || !res.ok) return;
      const dest = nextPath.startsWith("/admin") ? nextPath : "/admin";
      router.replace(dest);
    })();
    return () => {
      active = false;
    };
  }, [configMissing, forbidden, nextPath, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!normalizedIdentifier || !password) {
      setError("Username/email and password are required.");
      setLoading(false);
      return;
    }

    try {
      const sessionRes = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: normalizedIdentifier, password }),
      });
      const sessionPayload = (await sessionRes.json().catch(() => ({}))) as { error?: string };
      if (!sessionRes.ok) {
        setError(sessionPayload.error || "Sign in failed.");
        return;
      }

      setAuthFlash("Signed in to admin console successfully.", "success");
      router.replace(nextPath.startsWith("/admin") ? nextPath : "/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#f3f5f9] px-5 py-10 sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[#c9d7ff]/45 blur-3xl" />
        <div className="absolute bottom-[-9rem] right-[-6rem] h-80 w-80 rounded-full bg-[#a9c0ff]/35 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[460px] rounded-3xl border border-[#dbe3f2] bg-white/90 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f172a] text-white shadow-[0_8px_20px_rgba(15,23,42,0.35)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3.5l7 3.5v5.5c0 4.25-2.83 7.62-7 8.5-4.17-.88-7-4.25-7-8.5V7l7-3.5z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9.25 12l1.8 1.8 3.7-3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#52607a]">PAWLUXE</p>
            <h1 className="text-[27px] font-semibold leading-none tracking-tight text-[#101828]">Admin Console</h1>
          </div>
        </div>

        <p className="mb-6 rounded-2xl border border-[#e3eaf8] bg-[#f8fbff] px-4 py-3 text-[13px] leading-relaxed text-[#4b5c78]">
          Sign in using an account with <span className="font-semibold text-[#1e293b]">profiles.role = admin</span>.
        </p>

        {forbidden ? (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-[13px] leading-relaxed text-red-800" role="alert">
            Admin access only. This account is not allowed to open the admin console. Sign in with an account that has{" "}
            <span className="font-semibold">admin</span> role in profiles.
          </p>
        ) : null}

        {configMissing ? (
          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-[13px] leading-relaxed text-amber-900/90">
            Set <span className="font-mono text-[12px]">ADMIN_SESSION_SECRET</span> in{" "}
            <span className="font-mono text-[12px]">.env.local</span>, then restart the dev server.
          </p>
        ) : null}

        {success ? (
          <p className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center text-[13px] leading-relaxed text-emerald-800" role="status">
            {success}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#334155]">Username or Email</span>
            <input
              type="text"
              name="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-xl border border-[#d7deea] bg-white px-3.5 py-3 text-[16px] text-[#0f172a] outline-none transition focus:border-[#8ea5d9] focus:ring-4 focus:ring-[#d8e4ff]"
              placeholder="admin@example.com"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#334155]">Password</span>
            <div className="flex items-center rounded-xl border border-[#d7deea] bg-white pr-2 focus-within:border-[#8ea5d9] focus-within:ring-4 focus-within:ring-[#d8e4ff]">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-transparent px-3.5 py-3 text-[16px] text-[#0f172a] outline-none"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-[#475569] transition hover:bg-[#eef3ff]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-[13px] text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-[#111827] py-3 text-[15px] font-semibold text-white transition hover:bg-[#0b1220] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in to Admin"}
          </button>
        </form>

        <p className="mt-7 text-center text-[12px] text-[#64748b]">
          <Link href="/" className="font-medium text-[#475569] underline-offset-4 transition hover:text-[#0f172a] hover:underline">
            Back to storefront
          </Link>
        </p>
      </div>
    </div>
  );
}
