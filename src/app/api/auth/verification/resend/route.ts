import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveSessionUser } from "@/lib/customerProfile";
import {
  buildEmailVerificationLink,
  issueEmailVerificationToken,
  readEmailVerificationStatus,
  sendEmailVerificationMail,
} from "@/lib/emailVerification";

type ResendBody = {
  email?: unknown;
};

const RESEND_WINDOW_MS = 5 * 60 * 1000;
const RESEND_MAX_ATTEMPTS = 5;
const RESEND_BLOCK_MS = 5 * 60 * 1000;
const RESEND_RATE_LIMIT_MESSAGE =
  "You've requested verification too many times. Please wait a few minutes before trying again.";

type ResendAttemptState = {
  attempts: number;
  windowStart: number;
  blockedUntil: number;
};

const resendAttemptsStore = new Map<string, ResendAttemptState>();

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getResendKey(sessionSub: string | null, email: string): string {
  return sessionSub ? `user:${sessionSub}` : `email:${email}`;
}

function getRetryAfterSeconds(blockedUntil: number): number {
  return Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
}

function registerResendAttempt(key: string): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = resendAttemptsStore.get(key);

  if (current?.blockedUntil && current.blockedUntil > now) {
    return { blocked: true, retryAfterSeconds: getRetryAfterSeconds(current.blockedUntil) };
  }

  const shouldResetWindow = !current || now - current.windowStart > RESEND_WINDOW_MS;
  const nextAttempts = shouldResetWindow ? 1 : current.attempts + 1;
  const windowStart = shouldResetWindow ? now : current.windowStart;

  if (nextAttempts > RESEND_MAX_ATTEMPTS) {
    const blockedUntil = now + RESEND_BLOCK_MS;
    resendAttemptsStore.set(key, { attempts: nextAttempts, windowStart, blockedUntil });
    return { blocked: true, retryAfterSeconds: getRetryAfterSeconds(blockedUntil) };
  }

  resendAttemptsStore.set(key, { attempts: nextAttempts, windowStart, blockedUntil: 0 });
  return { blocked: false, retryAfterSeconds: 0 };
}

export async function POST(request: Request) {
  const session = await getCustomerFromRequest(request);

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth API is not configured." },
      { status: 503 }
    );
  }

  let resolved: Awaited<ReturnType<typeof resolveSessionUser>> | null = null;

  if (session) {
    const sessionKey = getResendKey(session.sub, "");
    const sessionAttempt = registerResendAttempt(sessionKey);
    if (sessionAttempt.blocked) {
      return NextResponse.json(
        {
          error: RESEND_RATE_LIMIT_MESSAGE,
          retryAfterSeconds: sessionAttempt.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    resolved = await resolveSessionUser(supabase, {
      sub: session.sub,
      username: session.username,
      email: session.email,
    });
    if (!resolved) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
  } else {
    let body: ResendBody;
    try {
      body = (await request.json()) as ResendBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid email." }, { status: 400 });
    }

    const emailKey = getResendKey(null, email);
    const emailAttempt = registerResendAttempt(emailKey);
    if (emailAttempt.blocked) {
      return NextResponse.json(
        {
          error: RESEND_RATE_LIMIT_MESSAGE,
          retryAfterSeconds: emailAttempt.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const { data: matchedUser, error: lookupError } = await supabase
      .from("users")
      .select("id,email,username,full_name,role")
      .ilike("email", email)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message || "Could not process verification request." }, { status: 400 });
    }

    if (!matchedUser) {
      return NextResponse.json({
        success: true,
        message: "If an account exists for that email, a verification email has been sent.",
      });
    }

    resolved = {
      id: String(matchedUser.id),
      email: String(matchedUser.email ?? "").trim().toLowerCase(),
      username: String(matchedUser.username ?? ""),
      full_name: typeof matchedUser.full_name === "string" ? matchedUser.full_name : null,
      role: typeof matchedUser.role === "string" ? matchedUser.role : "customer",
    };
  }

  if (!resolved) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const verificationStatus = await readEmailVerificationStatus(supabase, resolved.id);
  if (verificationStatus.error) {
    return NextResponse.json({ error: verificationStatus.error }, { status: 400 });
  }
  if (!verificationStatus.configured) {
    return NextResponse.json(
      { error: "Email verification is not configured. Please run the migration first." },
      { status: 500 }
    );
  }
  if (verificationStatus.isEmailVerified) {
    return NextResponse.json({
      success: true,
      alreadyVerified: true,
      message: "Email is already verified.",
    });
  }

  const recipientEmail = (verificationStatus.email ?? resolved.email ?? "").trim().toLowerCase();
  if (!recipientEmail) {
    return NextResponse.json({ error: "Account email is missing. Please update your email first." }, { status: 400 });
  }

  const issued = await issueEmailVerificationToken(supabase, resolved.id);
  if (issued.error || !issued.token) {
    return NextResponse.json({ error: issued.error || "Could not issue verification email." }, { status: 500 });
  }

  const verificationLink = buildEmailVerificationLink(request, issued.token, recipientEmail);
  const sent = await sendEmailVerificationMail({
    toEmail: recipientEmail,
    toName: resolved.full_name ?? resolved.username ?? null,
    verificationLink,
    expiresAt: issued.expiresAt,
  });
  if (!sent.sent) {
    return NextResponse.json(
      {
        error: sent.error || "Verification email could not be sent.",
      },
      { status: 503 }
    );
  }

  if (!session) {
    return NextResponse.json({
      success: true,
      message: "If an account exists for that email, a verification email has been sent.",
    });
  }

  return NextResponse.json({
    success: true,
    message: "Verification email sent. Please check your inbox.",
  });
}
