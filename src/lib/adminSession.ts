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

export async function createAdminSessionToken(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
  const payload = String(exp);
  const sig = await hmacSha256Hex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyAdminSessionToken(token: string, secret: string): Promise<boolean> {
  const i = token.lastIndexOf(".");
  if (i <= 0) return false;
  const expStr = token.slice(0, i);
  const sig = token.slice(i + 1);
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacSha256Hex(secret, expStr);
  return timingSafeEqualHex(sig, expected);
}

export function getAdminAuthEnv(): { password: string; sessionSecret: string } | null {
  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
  if (!password || !sessionSecret) return null;
  return { password, sessionSecret };
}
