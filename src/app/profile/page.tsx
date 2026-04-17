import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProfileClient from "@/components/auth/ProfileClient";
import { CUSTOMER_SESSION_COOKIE, verifyCustomerJwt } from "@/lib/customerJwt";
import {
  loadCustomerProfileForSession,
  resolveSessionUser,
  type ProfileUser,
} from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { readEmailVerificationStatus } from "@/lib/emailVerification";

export const metadata = {
  title: "My Profile - PAWLUXE",
  description: "View and update your PAWLUXE customer profile.",
};

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  const session = token ? await verifyCustomerJwt(token) : null;

  if (!session) {
    redirect("/auth/login?next=/profile");
  }

  let initialUser: ProfileUser | null = null;
  let initialError: string | null = null;

  try {
    const supabase = getSupabaseServerClient();
    const resolvedUser = await resolveSessionUser(supabase, {
      sub: session.sub,
      username: session.username,
      email: session.email,
    });
    if (resolvedUser) {
      const verification = await readEmailVerificationStatus(supabase, resolvedUser.id);
      if (!verification.error && verification.configured && !verification.isEmailVerified) {
        const email = encodeURIComponent(verification.email ?? session.email);
        redirect(`/auth/verify-email?email=${email}&source=protected`);
      }
    }
    const result = await loadCustomerProfileForSession(supabase, {
      sub: session.sub,
      username: session.username,
      email: session.email,
    });

    if (result.user) {
      initialUser = result.user;
    } else if (result.status === 404) {
      initialError = result.error;
    } else {
      initialError = result.error;
    }
  } catch (err) {
    initialError = err instanceof Error ? err.message : "Could not load profile details.";
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-cream to-amber-50/25 px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <ProfileClient initialUser={initialUser} initialError={initialError} />
      </div>
    </div>
  );
}
