import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminSession";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";
import {
  buildEmailVerificationLink,
  issueEmailVerificationToken,
  sendEmailVerificationMail,
} from "@/lib/emailVerification";

type RegisterBody = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
  fullName?: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUsername(value: string): boolean {
  return /^[a-zA-Z0-9._-]{3,30}$/.test(value);
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

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");
  const username = String(body.username ?? "").trim().toLowerCase();
  const fullName = String(body.fullName ?? "").trim();

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please provide a valid email." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (fullName.length < 2) {
    return NextResponse.json({ error: "Please enter your full name (at least 2 characters)." }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 3-30 characters (letters, numbers, ., _, -)." },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id")
    .or(`email.eq.${email},username.eq.${username}`)
    .limit(1);

  if (existingError) {
    return NextResponse.json({ error: existingError.message || "Could not validate email." }, { status: 400 });
  }
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json({ error: "Email or username already registered." }, { status: 409 });
  }

  const insertPayload = {
    email,
    username,
    password,
    full_name: fullName,
    role: "customer",
  };
  const { data: createdWithRole, error: createWithRoleErr } = await supabase
    .from("users")
    .insert(insertPayload)
    .select("id, email, username, full_name, role")
    .single();

  let created = createdWithRole;
  let createError = createWithRoleErr;

  if (createError && createError.message.toLowerCase().includes("role")) {
    const { data: createdWithoutRole, error: createWithoutRoleErr } = await supabase
      .from("users")
      .insert({
        email,
        username,
        password, // Requested: plain text password for now
        full_name: fullName,
      })
      .select("id, email, username, full_name")
      .single();
    created = createdWithoutRole ? { ...createdWithoutRole, role: "customer" } : null;
    createError = createWithoutRoleErr;
  }

  if (createError || !created) {
    return NextResponse.json({ error: createError?.message || "Could not create user." }, { status: 400 });
  }

  const verification = await issueEmailVerificationToken(supabase, created.id, { markUnverified: true });
  if (verification.error || !verification.token) {
    return NextResponse.json(
      { error: verification.error || "Could not initialize email verification." },
      { status: 500 }
    );
  }
  const verificationLink = buildEmailVerificationLink(request, verification.token, created.email);
  const verificationEmail = await sendEmailVerificationMail({
    toEmail: created.email,
    toName: created.full_name ?? created.username ?? null,
    verificationLink,
    expiresAt: verification.expiresAt,
  });

  const profilePayload = {
    user_id: userIdForDbQuery(created.id),
    username: created.username,
    full_name: created.full_name ?? null,
    avatar_url: created.full_name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(created.full_name)}` : null,
    phone: null,
    gender: null,
    dob: null,
  };

  const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "user_id" });
  if (profileError) {
    const message = profileError.message?.toLowerCase() ?? "";
    const profilesMissing = message.includes("profiles") && (message.includes("does not exist") || message.includes("could not find"));
    if (!profilesMissing) {
      return NextResponse.json({ error: profileError.message || "Could not create profile." }, { status: 400 });
    }
  }

  const response = NextResponse.json({
    success: true,
    emailVerification: {
      isEmailVerified: false,
      verificationEmailSent: verificationEmail.sent,
      message: verificationEmail.sent
        ? "Check your email to verify your account."
        : "Account created, but verification email could not be sent. Use resend verification email from the banner.",
    },
    nextStep: {
      path: "/auth/verify-email",
      requiresEmailVerification: true,
    },
    user: {
      id: String(created.id),
      email: created.email,
      username: created.username,
      full_name: created.full_name ?? null,
      role: created.role ?? "customer",
      isEmailVerified: false,
    },
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
