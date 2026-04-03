"use client";

import { useEffect, useState } from "react";

const sizeStyles = {
  sm: "h-10 w-10 min-h-[2.5rem] min-w-[2.5rem] text-[11px] leading-none tracking-wide",
  md: "h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] text-sm leading-none tracking-wide",
  lg: "h-[5.25rem] w-[5.25rem] min-h-[5.25rem] min-w-[5.25rem] text-[1.05rem] leading-none tracking-tight sm:h-24 sm:w-24 sm:min-h-[6rem] sm:min-w-[6rem] sm:text-[1.2rem] sm:tracking-tight",
} as const;

export type UserAvatarSize = keyof typeof sizeStyles;

/** Two-letter initials; matches navbar-style token splitting. */
export function getAvatarInitials(fullName: string | null | undefined, username: string): string {
  const raw = (fullName?.trim() || username || "").trim();
  if (!raw) return "?";
  const parts = raw.split(/[._\s-]+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || raw.charAt(0).toUpperCase();
}

type UserAvatarProps = {
  src?: string | null;
  alt: string;
  initials: string;
  size?: UserAvatarSize;
  className?: string;
};

/**
 * Profile / nav avatar: soft gradient ring, shadow, graceful image fallback.
 */
export function UserAvatar({ src, alt, initials, size = "md", className = "" }: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const safeInitials = (initials || "?").slice(0, 2).toUpperCase();
  const showPhoto = Boolean(src?.trim()) && !imgFailed;

  return (
    <div
      className={`relative shrink-0 rounded-full bg-gradient-to-br from-amber-100/90 via-white to-sage/35 p-[2.5px] shadow-[0_6px_28px_rgba(44,36,32,0.11)] ring-1 ring-amber-200/45 ${sizeStyles[size]} ${className}`}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
        {showPhoto ? (
          <img
            src={src!.trim()}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sage/20 via-cream to-amber-50/90 font-semibold text-umber antialiased"
            aria-hidden="true"
          >
            {safeInitials}
          </span>
        )}
      </div>
    </div>
  );
}
