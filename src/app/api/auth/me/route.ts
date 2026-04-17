import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveSessionUser } from "@/lib/customerProfile";
import { readEmailVerificationStatus } from "@/lib/emailVerification";

export async function GET(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json({
      user: {
        id: customer.sub,
        email: customer.email,
        username: customer.username,
        full_name: customer.fullName,
        role: customer.role,
        isEmailVerified: true,
      },
    });
  }

  const resolvedUser = await resolveSessionUser(supabase, {
    sub: customer.sub,
    username: customer.username,
    email: customer.email,
  });
  const verification = resolvedUser
    ? await readEmailVerificationStatus(supabase, resolvedUser.id)
    : null;
  const isEmailVerified = verification?.isEmailVerified ?? true;

  return NextResponse.json({
    user: {
      id: customer.sub,
      email: customer.email,
      username: customer.username,
      full_name: customer.fullName,
      role: customer.role,
      isEmailVerified,
    },
  });
}
