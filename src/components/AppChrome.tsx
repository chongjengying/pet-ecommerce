"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isCheckoutFlowRoute =
    pathname.startsWith("/cart") || pathname.startsWith("/checkout") || pathname.startsWith("/payment");

  if (isAdminRoute || isCheckoutFlowRoute) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Suspense fallback={<div className="h-16 w-full border-b border-amber-200/80 bg-cream/90" aria-hidden="true" />}>
        <Navbar />
      </Suspense>
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <a
        href="https://wa.me/"
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition hover:scale-105 hover:bg-[#1ebe5d]"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
          <path d="M19.05 4.94A9.94 9.94 0 0 0 12.03 2C6.55 2 2.08 6.46 2.08 11.95c0 1.75.46 3.45 1.32 4.95L2 22l5.24-1.37a9.9 9.9 0 0 0 4.78 1.22h.01c5.48 0 9.95-4.46 9.95-9.95a9.86 9.86 0 0 0-2.93-6.96Zm-7.02 15.22h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.11.81.83-3.03-.2-.31a8.23 8.23 0 0 1-1.26-4.36c0-4.57 3.72-8.29 8.3-8.29 2.22 0 4.31.86 5.88 2.43a8.23 8.23 0 0 1 2.43 5.88c0 4.58-3.72 8.29-8.28 8.29Zm4.55-6.2c-.25-.12-1.49-.74-1.72-.83-.23-.08-.4-.12-.57.12-.17.25-.65.83-.8 1-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.25-1.47-1.4-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.37-.78-1.88-.2-.48-.4-.41-.57-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.02 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.05.42 1.41.53.59.19 1.12.16 1.54.1.47-.07 1.49-.61 1.7-1.19.21-.58.21-1.08.15-1.19-.06-.11-.23-.17-.48-.29Z" />
        </svg>
      </a>
      <Footer />
    </>
  );
}
