import CustomerSignupForm from "@/components/auth/CustomerSignupForm";

export const metadata = {
  title: "Create Account - PAWLUXE",
  description: "Create your PAWLUXE customer account.",
};

export default function CustomerSignupPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-[#f9f7f2] to-[#eef4ea] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <CustomerSignupForm />
      </div>
    </div>
  );
}
