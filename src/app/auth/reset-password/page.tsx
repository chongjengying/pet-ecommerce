import Image from "next/image";
import CustomerResetPasswordForm from "@/components/auth/CustomerResetPasswordForm";

export const metadata = {
  title: "Change Password - PAWLUXE",
  description: "Verify OTP and change your PAWLUXE password.",
};

export default function CustomerResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_#f4eadc_0%,_#f8f3ea_35%,_#f1f7ee_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-amber-200/70 bg-white/85 shadow-[0_30px_80px_rgba(58,40,30,0.14)] backdrop-blur">
        <div className="grid min-h-[640px] lg:grid-cols-[1.15fr_1fr]">
          <section className="relative hidden p-6 lg:block">
            <div className="relative h-full overflow-hidden rounded-[1.6rem]">
              <Image src="/Pet forgot password page.png" alt="Cute pets" fill priority className="object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(235,117,160,0.58),rgba(244,150,184,0.52),rgba(232,120,168,0.62))]" />
              <div className="absolute left-8 top-8 max-w-sm text-white">
                <h1 className="text-6xl font-semibold leading-[1.02] tracking-tight">Change Password</h1>
              </div>
            </div>
          </section>

          <section className="flex items-center px-5 py-8 sm:px-8 lg:px-10">
            <CustomerResetPasswordForm />
          </section>
        </div>
      </div>
    </div>
  );
}
