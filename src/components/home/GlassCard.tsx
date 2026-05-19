"use client";

import type { PropsWithChildren } from "react";

export default function GlassCard({
  children,
  className = "",
}: PropsWithChildren<{
  className?: string;
}>) {
  return (
    <div
      className={[
        "rounded-3xl border border-amber-200/70 bg-white/70 shadow-sm backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

