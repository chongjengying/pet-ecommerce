"use client";

import Image from "next/image";
import { useState } from "react";

type AdminImageZoomViewerProps = {
  src: string;
  alt: string;
  thumbClassName?: string;
};

export default function AdminImageZoomViewer({
  src,
  alt,
  thumbClassName = "relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-amber-50",
}: AdminImageZoomViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${thumbClassName} cursor-zoom-in`}
        title="View image"
        aria-label={`View ${alt} image`}
      >
        <Image src={src} alt={alt} fill className="object-cover" sizes="40px" unoptimized />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[200] bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${alt}`}
        >
          <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-center">
            <div
              className="relative h-[82vh] w-full overflow-hidden rounded-xl bg-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <Image src={src} alt={alt} fill className="object-contain" sizes="90vw" unoptimized />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 rounded-md bg-white/90 px-3 py-1.5 text-xs font-semibold text-umber hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
