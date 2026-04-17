import { Suspense } from "react";
import EmailVerificationClient from "@/components/auth/EmailVerificationClient";

export const metadata = {
  title: "Verify Email - PAWLUXE",
  description: "Verify your PAWLUXE account email.",
};

export default function VerifyEmailPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-[#f9f7f2] to-[#eef4ea] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Suspense
          fallback={<div className="mx-auto w-full max-w-md rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-umber">Loading verification...</div>}
        >
          <EmailVerificationClient />
        </Suspense>
      </div>
    </div>
  );
}
