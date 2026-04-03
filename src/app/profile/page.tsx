import ProfileClient from "@/components/auth/ProfileClient";

export const metadata = {
  title: "My Profile - PAWLUXE",
  description: "View your PAWLUXE customer profile.",
};

export default function ProfilePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-[#f9f7f2] to-[#eef4ea] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <ProfileClient />
      </div>
    </div>
  );
}
