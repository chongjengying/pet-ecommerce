import Image from "next/image";
import CustomerForgotPasswordForm from "@/components/auth/CustomerForgotPasswordForm";

export const metadata = {
  title: "Forgot Password - PAWLUXE",
  description: "Reset your PAWLUXE customer password.",
};

export default function CustomerForgotPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_#f3efe7_0%,_#f8f5ef_40%,_#eef2ea_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-amber-200/70 bg-white/85 shadow-[0_30px_80px_rgba(58,40,30,0.14)] backdrop-blur">
        <div className="grid min-h-[640px] lg:grid-cols-[1.15fr_1fr]">
          <section className="relative hidden p-6 lg:block">
            <div className="relative h-full overflow-hidden rounded-[1.6rem]">
              <Image src="/Pet forgot password page.png" alt="Cute pets" fill priority className="object-contain bg-[#ece8df]" />
            </div>
          </section>

          <section className="flex items-center px-5 py-8 sm:px-8 lg:px-10">
            <CustomerForgotPasswordForm />
          </section>
        </div>
      </div>
    </div>
  );
}
