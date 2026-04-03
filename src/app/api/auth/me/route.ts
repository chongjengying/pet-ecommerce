import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";

export async function GET(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: customer.sub,
      email: customer.email,
      username: customer.username,
      full_name: customer.fullName,
      role: customer.role,
    },
  });
}
