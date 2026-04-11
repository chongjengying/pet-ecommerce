import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AddressBookClient from "@/components/auth/AddressBookClient";
import { CUSTOMER_SESSION_COOKIE, verifyCustomerJwt } from "@/lib/customerJwt";
import {
  loadCustomerProfileForSession,
  type ProfileUser,
} from "@/lib/customerProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const metadata = {
  title: "Address Book - PAWLUXE",
  description: "Manage your shipping and billing addresses in your PAWLUXE account.",
};

export default async function AddressBookPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  const session = token ? await verifyCustomerJwt(token) : null;

  if (!session) {
    redirect("/auth/login?next=/address-book");
  }

  let initialUser: ProfileUser | null = null;
  let initialError: string | null = null;

  try {
    const supabase = getSupabaseServerClient();
    const result = await loadCustomerProfileForSession(supabase, {
      sub: session.sub,
      username: session.username,
      email: session.email,
    });

    if (result.user) {
      initialUser = result.user;
    } else {
      initialError = result.error;
    }
  } catch (err) {
    initialError = err instanceof Error ? err.message : "Could not load address book details.";
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cream via-cream to-amber-50/25 px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-5xl">
        <AddressBookClient initialUser={initialUser} initialError={initialError} />
      </div>
    </div>
  );
}
