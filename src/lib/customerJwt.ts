import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";

export const CUSTOMER_SESSION_COOKIE = "customer_session";
export const CUSTOMER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export type CustomerJwtPayload = {
  sub: string;
  email: string;
  username: string;
  fullName: string | null;
  role: string;
  iat: number;
  exp: number;
};

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Buffer.from(signature).toString("base64url");
}

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function parseTokenParts(token: string): { headerB64: string; payloadB64: string; sigB64: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;
  return { headerB64, payloadB64, sigB64 };
}

function parsePayload(payloadB64: string): CustomerJwtPayload | null {
  try {
    const payload = JSON.parse(fromBase64Url(payloadB64)) as Partial<CustomerJwtPayload>;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
      fullName: typeof payload.fullName === "string" ? payload.fullName : null,
    };
  } catch {
    return null;
  }
}

export function getCustomerAuthSecret(): string | null {
  const secret = process.env.CUSTOMER_JWT_SECRET?.trim() ?? "";
  return secret || null;
}

export async function createCustomerJwt(data: {
  id: string | number;
  email: string;
  username: string;
  fullName?: string | null;
  role?: string | null;
}): Promise<string> {
  const secret = getCustomerAuthSecret();
  if (!secret) {
    throw new Error("Missing CUSTOMER_JWT_SECRET.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: CustomerJwtPayload = {
    sub: String(data.id),
    email: data.email,
    username: data.username,
    fullName: data.fullName?.trim() || null,
    role: data.role?.trim() || "customer",
    iat: now,
    exp: now + CUSTOMER_SESSION_MAX_AGE_SEC,
  };
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };

  const headerB64 = toBase64Url(JSON.stringify(header));
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigB64 = await hmacSha256Base64Url(secret, signingInput);
  return `${signingInput}.${sigB64}`;
}

export async function verifyCustomerJwt(token: string): Promise<CustomerJwtPayload | null> {
  const secret = getCustomerAuthSecret();
  if (!secret) return null;

  const parts = parseTokenParts(token);
  if (!parts) return null;

  const { headerB64, payloadB64, sigB64 } = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = await hmacSha256Base64Url(secret, signingInput);
  if (!safeEqualString(sigB64, expectedSig)) return null;

  let header: JwtHeader | null = null;
  try {
    header = JSON.parse(fromBase64Url(headerB64)) as JwtHeader;
  } catch {
    return null;
  }
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") return null;

  const payload = parsePayload(payloadB64);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;

  return payload;
}

export async function getCustomerFromRequest(request: Request): Promise<CustomerJwtPayload | null> {
  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  const token = bearer || cookieToken;
  if (!token) return null;

  return verifyCustomerJwt(token);
}
