import type { ReactNode } from "react";

interface AdminStatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export default function AdminStatCard({ label, value, hint }: AdminStatCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}

