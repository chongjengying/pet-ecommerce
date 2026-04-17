import { createHash, randomBytes } from "crypto";
import { userIdForDbQuery } from "@/lib/userIdDb";
import { getEmailFrom, getResendClient } from "@/lib/resend";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

type DbError = { message?: string } | null;

type SupabaseLike = {
  from: (table: string) => any;
};

type VerificationStatusResult = {
  configured: boolean;
  isEmailVerified: boolean;
  email: string | null;
  emailVerificationExpires: string | null;
  error: string | null;
};

type IssueVerificationResult = {
  token: string | null;
  expiresAt: string | null;
  error: string | null;
};

type VerifyTokenResult =
  | { ok: true; alreadyVerified: boolean; error: null }
  | {
      ok: false;
      alreadyVerified: false;
      error: string;
      code: "INVALID_OR_EXPIRED_TOKEN" | "TOKEN_EXPIRED" | "TOKEN_ALREADY_USED" | "NOT_CONFIGURED" | "UNKNOWN";
    };

type VerificationColumnSet = {
  tokenHashKey: string;
  expiresAtKey: string;
  verifiedAtKey: string;
  usedAtKey?: string;
  verifiedBoolKey?: string;
};

const VERIFICATION_COLUMN_SETS: VerificationColumnSet[] = [
  {
    tokenHashKey: "email_verification_token_hash",
    expiresAtKey: "email_verification_expires_at",
    verifiedAtKey: "email_verified_at",
  },
  {
    tokenHashKey: "email_verification_token_hash",
    expiresAtKey: "email_verification_expires_at",
    verifiedAtKey: "email_verified_at",
    verifiedBoolKey: "email_verified",
  },
  {
    tokenHashKey: "email_verification_token_hash",
    expiresAtKey: "email_verification_expires_at",
    verifiedAtKey: "email_verified_at",
    verifiedBoolKey: "is_email_verified",
  },
  {
    tokenHashKey: "email_verification_token_hash",
    expiresAtKey: "email_verification_expires_at",
    verifiedAtKey: "email_verified_at",
    usedAtKey: "email_verification_used_at",
  },
  {
    tokenHashKey: "email_verification_token_hash",
    expiresAtKey: "email_verification_expires",
    verifiedAtKey: "email_verified_at",
    verifiedBoolKey: "is_email_verified",
  },
  {
    tokenHashKey: "emailVerificationToken",
    expiresAtKey: "emailVerificationExpires",
    verifiedAtKey: "emailVerifiedAt",
    verifiedBoolKey: "isEmailVerified",
  },
];

function isMissingColumnError(error: { message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("does not exist") || message.includes("could not find"));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function isSetTimestamp(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function getBaseAppUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

export function buildEmailVerificationLink(request: Request, token: string, email?: string | null): string {
  const base = getBaseAppUrl(request);
  const query = new URLSearchParams({ token });
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) query.set("email", normalizedEmail);
  return `${base}/verify-email?${query.toString()}`;
}

function readParsedVerificationStatus(parsed: Record<string, unknown>, columns: VerificationColumnSet): VerificationStatusResult {
  const verifiedByTimestamp = isSetTimestamp(parsed[columns.verifiedAtKey]);
  const verifiedByBool = columns.verifiedBoolKey ? parsed[columns.verifiedBoolKey] === true : false;

  return {
    configured: true,
    isEmailVerified: verifiedByTimestamp || verifiedByBool,
    email: normalizeEmail(parsed.email),
    emailVerificationExpires: typeof parsed[columns.expiresAtKey] === "string" ? String(parsed[columns.expiresAtKey]) : null,
    error: null,
  };
}

export async function readEmailVerificationStatus(
  supabase: SupabaseLike,
  userId: string | number
): Promise<VerificationStatusResult> {
  const idKey = userIdForDbQuery(userId);
  let sawMissingColumn = false;

  for (const columns of VERIFICATION_COLUMN_SETS) {
    const selectColumns = ["email", columns.verifiedAtKey, columns.expiresAtKey];
    if (columns.usedAtKey) {
      selectColumns.push(columns.usedAtKey);
    }
    if (columns.verifiedBoolKey) {
      selectColumns.push(columns.verifiedBoolKey);
    }

    const { data, error } = await supabase
      .from("users")
      .select(selectColumns.join(","))
      .eq("id", idKey)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        sawMissingColumn = true;
        continue;
      }

      return {
        configured: true,
        isEmailVerified: false,
        email: null,
        emailVerificationExpires: null,
        error: error.message || "Could not load email verification status.",
      };
    }

    if (!data) {
      return {
        configured: true,
        isEmailVerified: false,
        email: null,
        emailVerificationExpires: null,
        error: "User not found.",
      };
    }

    return readParsedVerificationStatus(data as Record<string, unknown>, columns);
  }

  if (sawMissingColumn) {
    return {
      configured: false,
      isEmailVerified: true,
      email: null,
      emailVerificationExpires: null,
      error: null,
    };
  }

  return {
    configured: true,
    isEmailVerified: false,
    email: null,
    emailVerificationExpires: null,
    error: "Could not load email verification status.",
  };
}

export async function issueEmailVerificationToken(
  supabase: SupabaseLike,
  userId: string | number,
  options: { markUnverified?: boolean } = {}
): Promise<IssueVerificationResult> {
  const idKey = userIdForDbQuery(userId);
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString();

  let sawMissingColumn = false;
  let issueError: string | null = null;

  for (const columns of VERIFICATION_COLUMN_SETS) {
    const payload: Record<string, unknown> = {
      [columns.tokenHashKey]: tokenHash,
      [columns.expiresAtKey]: expiresAt,
    };
    if (columns.usedAtKey) {
      payload[columns.usedAtKey] = null;
    }

    if (options.markUnverified) {
      payload[columns.verifiedAtKey] = null;
      if (columns.verifiedBoolKey) {
        payload[columns.verifiedBoolKey] = false;
      }
    }

    const { error } = await supabase.from("users").update(payload).eq("id", idKey);
    if (!error) {
      return {
        token: rawToken,
        expiresAt,
        error: null,
      };
    }

    if (isMissingColumnError(error)) {
      sawMissingColumn = true;
      continue;
    }

    issueError = error.message || "Could not create verification token.";
    break;
  }

  if (issueError) {
    return { token: null, expiresAt: null, error: issueError };
  }

  if (sawMissingColumn) {
    return {
      token: null,
      expiresAt: null,
      error:
        "Email verification columns are missing. Expected at least email_verified_at, email_verification_token_hash, and email_verification_expires_at.",
    };
  }

  return { token: null, expiresAt: null, error: "Could not create verification token." };
}

async function clearVerificationToken(
  supabase: SupabaseLike,
  userId: string | number,
  preferredColumns?: VerificationColumnSet
): Promise<void> {
  const idKey = userIdForDbQuery(userId);
  const attempts = preferredColumns
    ? [preferredColumns, ...VERIFICATION_COLUMN_SETS.filter((set) => set !== preferredColumns)]
    : VERIFICATION_COLUMN_SETS;

  for (const columns of attempts) {
    const payload: Record<string, unknown> = {
      [columns.tokenHashKey]: null,
      [columns.expiresAtKey]: null,
    };
    const { error } = await supabase.from("users").update(payload).eq("id", idKey);
    if (!error || !isMissingColumnError(error)) return;
  }
}

export async function verifyEmailByToken(
  supabase: SupabaseLike,
  token: string,
  options: { email?: string | null } = {}
): Promise<VerifyTokenResult> {
  const trimmedToken = token.trim();
  if (!trimmedToken || trimmedToken.length < 16) {
    return { ok: false, alreadyVerified: false, error: "Invalid verification token.", code: "INVALID_OR_EXPIRED_TOKEN" };
  }

  const expectedEmail = normalizeEmail(options.email);
  const tokenHash = hashToken(trimmedToken);
  let sawMissingColumn = false;
  let lastError: string | null = null;

  for (const columns of VERIFICATION_COLUMN_SETS) {
    const selectColumns = ["id", "email", columns.verifiedAtKey, columns.expiresAtKey];
    if (columns.usedAtKey) {
      selectColumns.push(columns.usedAtKey);
    }
    if (columns.verifiedBoolKey) {
      selectColumns.push(columns.verifiedBoolKey);
    }

    const { data, error } = await supabase
      .from("users")
      .select(selectColumns.join(","))
      .eq(columns.tokenHashKey, tokenHash)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        sawMissingColumn = true;
        continue;
      }
      lastError = error.message || "Could not verify email.";
      break;
    }

    if (!data) {
      continue;
    }

    const row = data as Record<string, unknown>;
    const rowEmail = normalizeEmail(row.email);
    if (expectedEmail && rowEmail !== expectedEmail) {
      return {
        ok: false,
        alreadyVerified: false,
        error: "Verification link does not match the provided email.",
        code: "INVALID_OR_EXPIRED_TOKEN",
      };
    }

    const userId = row.id as string | number;
    const alreadyVerified = isSetTimestamp(row[columns.verifiedAtKey]) || (columns.verifiedBoolKey ? row[columns.verifiedBoolKey] === true : false);
    if (alreadyVerified) {
      return {
        ok: false,
        alreadyVerified: false,
        error: "Verification link is invalid or already used.",
        code: "TOKEN_ALREADY_USED",
      };
    }

    const usedAtRaw = columns.usedAtKey ? row[columns.usedAtKey] : null;
    if (columns.usedAtKey && isSetTimestamp(usedAtRaw)) {
      await clearVerificationToken(supabase, userId, columns);
      return {
        ok: false,
        alreadyVerified: false,
        error: "Verification link has already been used. Request a new verification email.",
        code: "TOKEN_ALREADY_USED",
      };
    }

    const expiresAtRaw = row[columns.expiresAtKey];
    const expiresAtMs = typeof expiresAtRaw === "string" ? Date.parse(expiresAtRaw) : Number.NaN;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
      await clearVerificationToken(supabase, userId, columns);
      return {
        ok: false,
        alreadyVerified: false,
        error: "Verification link has expired. Request a new verification email.",
        code: "TOKEN_EXPIRED",
      };
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      [columns.verifiedAtKey]: nowIso,
      [columns.tokenHashKey]: null,
      [columns.expiresAtKey]: null,
    };
    if (columns.usedAtKey) {
      updatePayload[columns.usedAtKey] = nowIso;
    }
    if (columns.verifiedBoolKey) {
      updatePayload[columns.verifiedBoolKey] = true;
    }

    const { error: updateError } = await supabase.from("users").update(updatePayload).eq("id", userIdForDbQuery(userId));
    if (updateError) {
      return { ok: false, alreadyVerified: false, error: updateError.message || "Could not verify email.", code: "UNKNOWN" };
    }

    return { ok: true, alreadyVerified: false, error: null };
  }

  if (lastError) {
    return { ok: false, alreadyVerified: false, error: lastError, code: "UNKNOWN" };
  }

  if (sawMissingColumn) {
    return {
      ok: false,
      alreadyVerified: false,
      error:
        "Email verification is not configured. Expected at least email_verified_at, email_verification_token_hash, and email_verification_expires_at.",
      code: "NOT_CONFIGURED",
    };
  }

  return {
    ok: false,
    alreadyVerified: false,
    error: "Verification link is invalid or already used.",
    code: "INVALID_OR_EXPIRED_TOKEN",
  };
}

type SendVerificationEmailInput = {
  toEmail: string;
  toName?: string | null;
  verificationLink: string;
  expiresAt?: string | null;
};

export async function sendEmailVerificationMail(input: SendVerificationEmailInput): Promise<{ sent: boolean; error: string | null }> {
  const toEmail = input.toEmail.trim().toLowerCase();
  if (!toEmail) return { sent: false, error: "Missing recipient email." };

  const displayName = input.toName?.trim() || "there";
  const expiresText = input.expiresAt
    ? new Date(input.expiresAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })
    : "24 hours";

  const subject = "Verify your email - Pawluxe";
  const text = [
    `Hi ${displayName},`,
    "",
    "Please verify your email address to secure your account.",
    `Verification link: ${input.verificationLink}`,
    `This link expires at: ${expiresText} (Asia/Kuala_Lumpur)`,
    "",
    "If you did not create this account, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Hi ${displayName.replaceAll("<", "&lt;").replaceAll(">", "&gt;")},</p>
      <p>Please verify your email address to secure your account.</p>
      <p>
        <a href="${input.verificationLink}" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">
          Verify Email
        </a>
      </p>
      <p style="font-size:13px;color:#4b5563">
        This link expires at: ${expiresText} (Asia/Kuala_Lumpur)
      </p>
      <p style="font-size:13px;color:#6b7280">
        If you did not create this account, you can ignore this email.
      </p>
    </div>
  `.trim();

  try {
    const resend = getResendClient();
    const from = getEmailFrom();
    const { error } = await resend.emails.send({
      from,
      to: toEmail,
      subject,
      text,
      html,
    });
    if (error) {
      return {
        sent: false,
        error: error.message || "Email provider request failed.",
      };
    }

    return { sent: true, error: null };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Failed to send verification email." };
  }
}
