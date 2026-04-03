import ProfileClient from "@/components/auth/ProfileClient";

export const metadata = {
  title: "My Profile - PAWLUXE",
  description: "View and update your PAWLUXE customer profile.",
};

export default function ProfilePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-cream to-amber-50/25 px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <ProfileClient />
      </div>
    </div>
  );
}
