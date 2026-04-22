import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminSession";
import { createCustomerJwt, CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_MAX_AGE_SEC } from "@/lib/customerJwt";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { isAdminRole, resolveProfileRole } from "@/lib/userRole";
import { isUserAccountActive } from "@/lib/userAccountState";
import { updateUserLastLoginAt } from "@/lib/userLoginAudit";
import {
  buildEmailVerificationLink,
  issueEmailVerificationToken,
  readEmailVerificationStatus,
  sendEmailVerificationMail,
} from "@/lib/emailVerification";

type LoginBody = {
  identifier?: string;
  email?: string;
  password?: string;
};

type LoginUserRow = {
  id: string | number;
  email: string;
  password: string;
  password_hash?: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string | null;
};

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

type LoginAttemptState = {
  failedAttempts: number;
  lockedUntil: number;
};

const loginAttemptsStore = new Map<string, LoginAttemptState>();

function getLockKey(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function getRetryAfterSeconds(lockedUntil: number): number {
  return Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
}

function getRemainingAttempts(failedAttempts: number): number {
  return Math.max(0, MAX_FAILED_LOGIN_ATTEMPTS - failedAttempts);
}

function getLoginAttemptState(identifier: string): LoginAttemptState {
  const key = getLockKey(identifier);
  const current = loginAttemptsStore.get(key);
  if (!current) {
    return { failedAttempts: 0, lockedUntil: 0 };
  }
  if (current.lockedUntil > 0 && current.lockedUntil <= Date.now()) {
    loginAttemptsStore.delete(key);
    return { failedAttempts: 0, lockedUntil: 0 };
  }
  return current;
}

function clearLoginAttemptState(identifier: string): void {
  loginAttemptsStore.delete(getLockKey(identifier));
}

function recordFailedLoginAttempt(identifier: string): LoginAttemptState {
  const key = getLockKey(identifier);
  const state = getLoginAttemptState(identifier);
  const nextFailedAttempts = state.failedAttempts + 1;
  const lockedUntil =
    nextFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCKOUT_MS : state.lockedUntil;
  const nextState = {
    failedAttempts: nextFailedAttempts,
    lockedUntil,
  };
  loginAttemptsStore.set(key, nextState);
  return nextState;
}

function normalizeUserRow(row: Record<string, unknown>): LoginUserRow {
  const email = String(row.email ?? "").trim().toLowerCase();
  const usernameRaw = typeof row.username === "string" ? row.username.trim() : "";
  const firstName = typeof row.first_name === "string" ? row.first_name : null;
  const lastName = typeof row.last_name === "string" ? row.last_name : null;
  const legacyFullName = typeof row.full_name === "string" ? row.full_name : null;
  const derivedFullName = [firstName, lastName].filter(Boolean).join(" ").trim() || legacyFullName;
  return {
    id: row.id as string | number,
    email,
    password: typeof row.password === "string" ? row.password : "",
    password_hash: typeof row.password_hash === "string" ? row.password_hash : undefined,
    username: usernameRaw || (email.includes("@") ? email.split("@")[0] : email || "customer"),
    first_name: firstName,
    last_name: lastName,
    full_name: derivedFullName,
    role: typeof row.role === "string" ? row.role : "customer",
  };
}

function isMissingColumnError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("could not find") || message.includes("does not exist"));
}

function isMissingProfilesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("profiles") && (message.includes("does not exist") || message.includes("could not find"));
}

async function queryUserByEmailOrUsername(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  identifier: string
): Promise<{ user: LoginUserRow | null; error: string | null }> {
  const selects = [
    "id,email,password,password_hash,username,first_name,last_name,role",
    "id,email,password_hash,username,first_name,last_name,role",
    "id,email,password,username,first_name,last_name,role",
    "id,email,password,password_hash,username,role",
    "id,email,password_hash,username,role",
    "id,email,password,username,role",
    "id,email,password,password_hash,username,full_name,role",
    "id,email,password_hash,username,full_name,role",
    "id,email,password,username,full_name,role",
    "id,email,password_hash,username",
    "id,email,password,username",
    "id,email,password_hash",
    "id,email,password",
  ] as const;

  const select = async (fields: string) => {
    const byEmail = await supabase
      .from("users")
      .select(fields)
      .ilike("email", identifier)
      .order("id", { ascending: true })
      .limit(1);
    if (byEmail.error) return { rows: null as Record<string, unknown>[] | null, error: byEmail.error };
    if (Array.isArray(byEmail.data) && byEmail.data.length > 0) {
      return { rows: byEmail.data as unknown as Record<string, unknown>[], error: null };
    }

    const byUsername = await supabase
      .from("users")
      .select(fields)
      .ilike("username", identifier)
      .order("id", { ascending: true })
      .limit(1);
    if (byUsername.error) return { rows: null as Record<string, unknown>[] | null, error: byUsername.error };
    return { rows: (byUsername.data as unknown as Record<string, unknown>[] | null) ?? null, error: null };
  };

  let lastError = "";
  for (const fields of selects) {
    const attempt = await select(fields);
    if (!attempt.error) {
      const row = Array.isArray(attempt.rows) && attempt.rows.length > 0 ? attempt.rows[0] : null;
      return { user: row ? normalizeUserRow(row) : null, error: null };
    }
    if (!isMissingColumnError(attempt.error)) {
      return { user: null, error: attempt.error.message || "Could not validate login." };
    }
    lastError = attempt.error.message || "Could not validate login.";
  }
  return { user: null, error: lastError };
}

async function queryUserById(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string | number
): Promise<{ user: LoginUserRow | null; error: string | null }> {
  const selects = [
    "id,email,password,password_hash,username,first_name,last_name,role",
    "id,email,password_hash,username,first_name,last_name,role",
    "id,email,password,username,first_name,last_name,role",
    "id,email,password,password_hash,username,role",
    "id,email,password_hash,username,role",
    "id,email,password,username,role",
    "id,email,password,password_hash,username,full_name,role",
    "id,email,password_hash,username,full_name,role",
    "id,email,password,username,full_name,role",
    "id,email,password_hash,username",
    "id,email,password,username",
    "id,email,password_hash",
    "id,email,password",
  ] as const;

  let lastError = "";
  for (const fields of selects) {
    const { data, error } = await supabase.from("users").select(fields).eq("id", userId).maybeSingle();
    if (!error) {
      return { user: data ? normalizeUserRow(data as unknown as Record<string, unknown>) : null, error: null };
    }
    if (!isMissingColumnError(error)) {
      return { user: null, error: error.message || "Could not validate login." };
    }
    lastError = error.message || "Could not validate login.";
  }

  return { user: null, error: lastError };
}

function safeEqualPassword(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function verifyPassword(input: string, stored: string): Promise<boolean> {
  const hashLike = /^\$2[aby]\$\d{2}\$/.test(stored);
  if (hashLike) {
    try {
      return await bcrypt.compare(input, stored);
    } catch {
      return false;
    }
  }
  return safeEqualPassword(input, stored);
}

function blockedCustomerAccountMessage(status: string | null): string {
  if (status === "inactive") {
    return "Your account is inactive. Please contact support to reactivate your account.";
  }
  if (status === "suspended") {
    return "Your account is suspended. Please contact support for assistance.";
  }
  if (status === "deleted") {
    return "This account has been deleted and cannot sign in.";
  }
  return "Your account is not allowed to sign in. Please contact support.";
}

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth API is not configured." },
      { status: 503 }
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rawIdentifier = String(body.identifier ?? body.email ?? "").trim();
  const identifier = rawIdentifier.toLowerCase();
  const password = String(body.password ?? "");

  if (!identifier || !password) {
    return NextResponse.json({ error: "Username/email and password are required." }, { status: 400 });
  }

  const attemptState = getLoginAttemptState(identifier);
  if (attemptState.lockedUntil > Date.now()) {
    const retryAfterSeconds = getRetryAfterSeconds(attemptState.lockedUntil);
    return NextResponse.json(
      {
        error: "Too many failed login attempts. Please wait 5 minutes before trying again.",
        retryAfterSeconds,
        temporarilyBlocked: true,
      },
      { status: 403 }
    );
  }

  const lookupResult = await queryUserByEmailOrUsername(supabase, identifier);
  let user = lookupResult.user;
  const userLookupError = lookupResult.error;
  if (userLookupError) {
    return NextResponse.json({ error: userLookupError }, { status: 400 });
  }

  // Fallback for legacy data where username is stored in profiles table.
  if (!user) {
    const { data: profileRows, error: profileLookupError } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("username", identifier)
      .order("user_id", { ascending: true })
      .limit(1);
    if (profileLookupError) {
      if (isMissingProfilesTable(profileLookupError)) {
        return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      }
      return NextResponse.json({ error: profileLookupError.message || "Could not validate login." }, { status: 400 });
    }
    const profileUserId = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0]?.user_id : null;
    if (profileUserId != null) {
      const byProfileResult = await queryUserById(supabase, String(profileUserId));
      if (byProfileResult.error) {
        return NextResponse.json({ error: byProfileResult.error }, { status: 400 });
      }
      user = byProfileResult.user;
    }
  }

  if (!user) {
    const failedState = recordFailedLoginAttempt(identifier);
    const isLocked = failedState.lockedUntil > Date.now();
    if (isLocked) {
      return NextResponse.json(
        {
          error: "Too many failed login attempts. Please wait 5 minutes before trying again.",
          retryAfterSeconds: getRetryAfterSeconds(failedState.lockedUntil),
          temporarilyBlocked: true,
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        error: "Invalid username/email or password.",
        remainingAttempts: getRemainingAttempts(failedState.failedAttempts),
      },
      { status: 401 }
    );
  }

  const savedPassword = String(user.password ?? user.password_hash ?? "");
  if (!(await verifyPassword(password, savedPassword))) {
    const failedState = recordFailedLoginAttempt(identifier);
    const isLocked = failedState.lockedUntil > Date.now();
    if (isLocked) {
      return NextResponse.json(
        {
          error: "Too many failed login attempts. Please wait 5 minutes before trying again.",
          retryAfterSeconds: getRetryAfterSeconds(failedState.lockedUntil),
          temporarilyBlocked: true,
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        error: "Invalid username/email or password.",
        remainingAttempts: getRemainingAttempts(failedState.failedAttempts),
      },
      { status: 401 }
    );
  }

  clearLoginAttemptState(identifier);

  const accountState = await isUserAccountActive(supabase, user.id);
  if (accountState.error) {
    return NextResponse.json({ error: accountState.error }, { status: 400 });
  }
  if (!accountState.active) {
    return NextResponse.json({ error: blockedCustomerAccountMessage(accountState.status) }, { status: 403 });
  }

  const profileRole = await resolveProfileRole(supabase, user.id, { missingProfiles: "treatAsNoRole" });
  if (profileRole.error) {
    return NextResponse.json({ error: profileRole.error }, { status: 400 });
  }
  if (isAdminRole(profileRole.role) || isAdminRole(user.role)) {
    return NextResponse.json(
      {
        error:
          "This account is for admin access only. Sign in on the admin site — customer sign-in is not available for this account.",
      },
      { status: 403 }
    );
  }

  const effectiveRole = profileRole.role ?? user.role ?? "customer";
  const verificationStatus = await readEmailVerificationStatus(supabase, user.id);
  const isEmailVerified = verificationStatus.isEmailVerified;

  const emailVerification = {
    isEmailVerified,
    verificationEmailSent: false,
    message: isEmailVerified ? null : "Check your email to verify your account.",
  };
  if (verificationStatus.configured && !isEmailVerified) {
    const existingExpiryMs = verificationStatus.emailVerificationExpires
      ? Date.parse(verificationStatus.emailVerificationExpires)
      : Number.NaN;
    const hasActiveToken = Number.isFinite(existingExpiryMs) && existingExpiryMs > Date.now();
    if (!hasActiveToken) {
      const issued = await issueEmailVerificationToken(supabase, user.id);
      if (!issued.error && issued.token) {
        const sent = await sendEmailVerificationMail({
          toEmail: user.email,
          toName: user.full_name ?? user.username ?? null,
          verificationLink: buildEmailVerificationLink(request, issued.token, user.email),
          expiresAt: issued.expiresAt,
        });
        if (sent.sent) {
          emailVerification.verificationEmailSent = true;
          emailVerification.message = "Verification link sent to your email. Please verify your account.";
        }
      }
    }
  }

  if (verificationStatus.configured && !isEmailVerified) {
    return NextResponse.json(
      {
        error: "Please verify your email before signing in.",
        requiresEmailVerification: true,
        email: user.email,
        emailVerification,
      },
      { status: 403 }
    );
  }

  const lastLoginUpdate = await updateUserLastLoginAt(supabase, user.id);
  if (lastLoginUpdate.error) {
    return NextResponse.json({ error: lastLoginUpdate.error }, { status: 400 });
  }

  let token = "";
  try {
    token = await createCustomerJwt({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      role: effectiveRole,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth API is not configured." },
      { status: 503 }
    );
  }

  const response = NextResponse.json({
    success: true,
    token,
    user: {
      id: String(user.id),
      email: user.email,
      username: user.username,
      full_name: user.full_name ?? null,
      role: effectiveRole,
      isEmailVerified,
    },
    emailVerification,
  });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_SESSION_MAX_AGE_SEC,
  });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
