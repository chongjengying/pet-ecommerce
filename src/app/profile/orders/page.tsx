import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OrderStatusClient from "@/components/orders/OrderStatusClient";
import { CUSTOMER_SESSION_COOKIE, verifyCustomerJwt } from "@/lib/customerJwt";
import { loadLatestCustomerOrderStatus } from "@/lib/customerOrders";

export const metadata = {
  title: "Order Status - PAWLUXE",
  description: "Track your latest PAWLUXE order, delivery progress, and payment details.",
};

export default async function ProfileOrdersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  const session = token ? await verifyCustomerJwt(token) : null;

  if (!session) {
    redirect("/auth/login?next=/profile/orders");
  }

  const order = await loadLatestCustomerOrderStatus({
    sub: session.sub,
    username: session.username,
    email: session.email,
  }).catch(() => null);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(180deg,rgba(251,247,240,1),rgba(255,252,246,0.96),rgba(248,242,231,0.72))] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="mx-auto max-w-7xl">
        <OrderStatusClient order={order} />
      </div>
    </div>
  );
}
