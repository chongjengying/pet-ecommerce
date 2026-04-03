import CustomerLoginForm from "@/components/auth/CustomerLoginForm";

export const metadata = {
  title: "Customer Login - PAWLUXE",
  description: "Sign in to your PAWLUXE customer account.",
};

export default function CustomerLoginPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-[#f9f7f2] to-[#eef4ea] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <CustomerLoginForm />
      </div>
    </div>
  );
}
