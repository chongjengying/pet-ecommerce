const STORAGE_KEY = "pawluxe_profile_cache_v1";

export type ProfileAddress = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
};

export type CachedProfileUser = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  addresses?: ProfileAddress[];
};

type Stored = {
  tokenPrefix: string;
  user: CachedProfileUser;
};

function tokenPrefix(token: string): string {
  return token.slice(0, 36);
}

export function readProfileCache(token: string | null): CachedProfileUser | null {
  if (typeof window === "undefined" || !token) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.tokenPrefix !== tokenPrefix(token)) return null;
    const u = parsed.user;
    if (u?.email && u?.username) return u;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeProfileCache(token: string | null, user: CachedProfileUser): void {
  if (typeof window === "undefined" || !token) return;
  try {
    const payload: Stored = { tokenPrefix: tokenPrefix(token), user };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearProfileCache(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
