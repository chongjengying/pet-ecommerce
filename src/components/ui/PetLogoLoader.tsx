"use client";

import { useState } from "react";

function PawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="40" cy="54" rx="20" ry="17" />
        <circle cx="22" cy="32" r="11" />
        <circle cx="40" cy="22" r="11" />
        <circle cx="58" cy="32" r="11" />
        <circle cx="30" cy="14" r="9" />
        <circle cx="50" cy="14" r="9" />
      </g>
    </svg>
  );
}

const sizeInner = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-[4.5rem] w-[4.5rem]",
} as const;

type PetLogoLoaderProps = {
  /** Set to null to hide the caption */
  label?: string | null;
  size?: keyof typeof sizeInner;
  className?: string;
  /** Try site logo first; falls back to animated paw */
  logoSrc?: string;
};

/**
 * Centered loading state: optional logo image, soft glow, paw fallback, bouncing dots.
 */
export function PetLogoLoader({
  label = "Loading…",
  size = "md",
  className = "",
  logoSrc = "/logo.png",
}: PetLogoLoaderProps) {
  const [useLogo, setUseLogo] = useState(true);
  const inner = sizeInner[size];

  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={`pet-loader-breathe relative flex ${inner} items-center justify-center`}>
        <div
          className="absolute -inset-4 rounded-full bg-gradient-to-br from-amber-200/45 via-sage/25 to-terracotta/15 blur-xl"
          aria-hidden="true"
        />
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-white via-cream to-amber-50/50 p-[3px] shadow-[0_10px_40px_rgba(44,36,32,0.1)] ring-[1.5px] ring-amber-200/60">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white/95">
            {useLogo ? (
              <img
                src={logoSrc}
                alt=""
                width={112}
                height={112}
                className="h-[88%] w-[88%] rounded-full object-cover"
                onError={() => setUseLogo(false)}
              />
            ) : (
              <PawMark className="h-[78%] w-[78%] shrink-0 text-sage" />
            )}
          </div>
        </div>
      </div>

      {label ? (
        <p className="text-center text-sm font-medium tracking-wide text-umber/55">{label}</p>
      ) : null}

      <div className="flex gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="pet-loader-dot h-2 w-2 rounded-full bg-sage/55"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
