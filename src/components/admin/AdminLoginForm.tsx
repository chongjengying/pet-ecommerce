"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/admin";
  const configMissing = searchParams.get("config") === "1";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Sign in failed.");
        return;
      }
      router.replace(nextPath.startsWith("/admin") ? nextPath : "/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-10 text-center">
          <p className="text-[13px] font-semibold tracking-[0.2em] text-neutral-400">PAWLUXE</p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-neutral-900">Admin</h1>
          <p className="mt-2 text-[15px] leading-snug text-neutral-500">Sign in to manage your store.</p>
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white/80 px-8 py-9 shadow-[0_2px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          {configMissing ? (
            <p className="mb-6 rounded-xl bg-amber-50 px-3 py-2.5 text-center text-[13px] leading-relaxed text-amber-900/90">
              Set <span className="font-mono text-[12px]">ADMIN_PASSWORD</span> and{" "}
              <span className="font-mono text-[12px]">ADMIN_SESSION_SECRET</span> in{" "}
              <span className="font-mono text-[12px]">.env.local</span>, then restart the dev server.
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-[13px] font-medium text-neutral-800">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[10px] border border-neutral-200 bg-white px-3.5 py-3 text-[17px] text-neutral-900 shadow-inner outline-none ring-0 transition placeholder:text-neutral-300 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/8"
                placeholder="Enter your password"
                required
              />
            </label>

            {error ? (
              <p className="text-center text-[13px] text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-[10px] bg-[#1d1d1f] py-3 text-[15px] font-semibold text-white transition hover:bg-[#000] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-[12px] text-neutral-400">
          <Link href="/" className="text-neutral-500 underline-offset-4 hover:text-neutral-700 hover:underline">
            Back to store
          </Link>
        </p>
      </div>
    </div>
  );
}
