import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OrderStatusClient from "@/components/orders/OrderStatusClient";
import { CUSTOMER_SESSION_COOKIE, verifyCustomerJwt } from "@/lib/customerJwt";
import { loadCustomerOrderStatuses } from "@/lib/customerOrders";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveSessionUser } from "@/lib/customerProfile";
import { readEmailVerificationStatus } from "@/lib/emailVerification";

export const metadata = {
  title: "Order Status - PAWLUXE",
  description: "Track your latest PAWLUXE order, delivery progress, and payment details.",
};

type ProfileOrdersPageProps = {
  searchParams?: Promise<{
    order?: string | string[];
  }> | {
    order?: string | string[];
  };
};

export default async function ProfileOrdersPage({ searchParams }: ProfileOrdersPageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  const session = token ? await verifyCustomerJwt(token) : null;
  const params = (await searchParams) ?? {};
  const initialOrderId = Array.isArray(params.order) ? params.order[0] : params.order ?? null;

  if (!session) {
    redirect("/auth/login?next=/profile/orders");
  }

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
  } catch {
    // Continue with default flow if verification check cannot run.
  }

  const orders = await loadCustomerOrderStatuses({
    sub: session.sub,
    username: session.username,
    email: session.email,
  }).catch((error: unknown) => {
    console.error("[profile/orders] Failed to load customer orders", {
      sub: session.sub,
      email: session.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(180deg,rgba(251,247,240,1),rgba(255,252,246,0.96),rgba(248,242,231,0.72))] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="mx-auto max-w-7xl">
        <OrderStatusClient orders={orders} initialOrderId={initialOrderId} />
      </div>
    </div>
  );
}
