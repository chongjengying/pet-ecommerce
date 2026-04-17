import type { ReactNode } from "react";

interface AdminFilterBarProps {
  children: ReactNode;
  actions?: ReactNode;
}

export default function AdminFilterBar({ children, actions }: AdminFilterBarProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)] md:flex-row md:items-center md:justify-between md:p-5">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">{children}</div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </section>
  );
}

