export const ADMIN_SESSION_COOKIE = "admin_session";

export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/**
 * Session token formats:
 * - New: `exp.userId.sig` — HMAC(secret, `${exp}.${userId}`) so we can resolve admin in `/api/admin/auth/me`.
 * - Legacy: `exp.sig` — HMAC(secret, exp) only (no user id; client should re-login to attach identity).
 */
export async function createAdminSessionToken(secret: string, userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
  const payload = `${exp}.${userId}`;
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export type AdminSessionVerifyResult =
  | { ok: true; userId: string }
  | { ok: true; legacy: true }
  | { ok: false };

export async function verifyAdminSessionToken(
  token: string,
  secret: string
): Promise<AdminSessionVerifyResult> {
  const parts = token.split(".");
  if (parts.length === 3) {
    const [expStr, userId, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return { ok: false };
    if (!userId) return { ok: false };
    const payload = `${expStr}.${userId}`;
    const expected = await hmacSha256Hex(secret, payload);
    if (!timingSafeEqualHex(sig, expected)) return { ok: false };
    return { ok: true, userId };
  }
  if (parts.length === 2) {
    const [expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return { ok: false };
    const expected = await hmacSha256Hex(secret, expStr);
    if (!timingSafeEqualHex(sig, expected)) return { ok: false };
    return { ok: true, legacy: true };
  }
  return { ok: false };
}

export function getAdminSessionSecret(): string | null {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
  return sessionSecret || null;
}
