/**
 * Values for Supabase `.eq("id", …)` / `.eq("user_id", …)` when `users.id` may be
 * `bigint` (legacy) or `uuid` (new schema). Never use `Number(uuid)` — it becomes NaN.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function userIdForDbQuery(userId: string | number): string | number {
  const s = String(userId).trim();
  if (UUID_RE.test(s)) return s;
  if (/^[0-9]+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return s;
}
