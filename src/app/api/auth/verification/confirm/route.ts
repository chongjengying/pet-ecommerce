import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { verifyEmailByToken } from "@/lib/emailVerification";

type ConfirmBody = {
  token?: unknown;
  email?: unknown;
};

async function extractParams(request: Request): Promise<{ token: string; email: string }> {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const queryEmail = url.searchParams.get("email");
  if (queryToken?.trim()) {
    return {
      token: queryToken.trim(),
      email: String(queryEmail ?? "").trim().toLowerCase(),
    };
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (request.method === "POST" && contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as ConfirmBody;
      return {
        token: String(body.token ?? "").trim(),
        email: String(body.email ?? "").trim().toLowerCase(),
      };
    } catch {
      return { token: "", email: "" };
    }
  }

  return { token: "", email: "" };
}

async function handleConfirm(request: Request) {
  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth API is not configured." },
      { status: 503 }
    );
  }

  const { token, email } = await extractParams(request);
  if (!token) {
    return NextResponse.json(
      { error: "Verification token is required." },
      { status: 400 }
    );
  }

  const result = await verifyEmailByToken(supabase, token, { email });
  if (!result.ok) {
    const status =
      result.code === "TOKEN_EXPIRED"
        ? 410
        : result.code === "TOKEN_ALREADY_USED"
          ? 409
        : result.code === "INVALID_OR_EXPIRED_TOKEN"
          ? 400
          : result.code === "NOT_CONFIGURED"
            ? 500
            : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    success: true,
    alreadyVerified: result.alreadyVerified,
    message: result.alreadyVerified ? "Email was already verified." : "Email verified successfully.",
  });
}

export async function GET(request: Request) {
  return handleConfirm(request);
}

export async function POST(request: Request) {
  return handleConfirm(request);
}
