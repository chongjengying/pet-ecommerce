import { getSupabaseServerClient } from "@/lib/supabaseServer";

type SupabaseClient = ReturnType<typeof getSupabaseServerClient>;

function isMissingProfilesTable(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("profiles") && (message.includes("does not exist") || message.includes("could not find"));
}

export type ResolveProfileRoleOptions = {
  /**
   * Admin login must fail if profiles is missing. Customer auth can fall back to `users.role`
   * when the profiles table is not deployed.
   */
  missingProfiles: "error" | "treatAsNoRole";
};

/**
 * Reads `profiles.role` for a user (supports legacy `profiles.id` join when `user_id` column is absent).
 */
export async function resolveProfileRole(
  supabase: SupabaseClient,
  userId: string | number,
  options: ResolveProfileRoleOptions
): Promise<{ role: string | null; error: string | null }> {
  const onMissingProfiles = () =>
    options.missingProfiles === "treatAsNoRole"
      ? { role: null as string | null, error: null as string | null }
      : { role: null as string | null, error: "Profiles table not found." as string | null };

  const byUserId = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", Number(userId))
    .maybeSingle();
  if (!byUserId.error) {
    const roleValue = byUserId.data && typeof byUserId.data.role === "string" ? byUserId.data.role : null;
    return { role: roleValue, error: null };
  }

  if (isMissingProfilesTable(byUserId.error)) {
    return onMissingProfiles();
  }

  const userIdErrMessage = String(byUserId.error.message ?? "").toLowerCase();
  if (!userIdErrMessage.includes("user_id") || !userIdErrMessage.includes("column")) {
    return { role: null, error: byUserId.error.message || "Could not validate role." };
  }

  const byId = await supabase
    .from("profiles")
    .select("role")
    .eq("id", Number(userId))
    .maybeSingle();
  if (byId.error) {
    if (isMissingProfilesTable(byId.error)) {
      return onMissingProfiles();
    }
    return { role: null, error: byId.error.message || "Could not validate role." };
  }

  const roleValue = byId.data && typeof byId.data.role === "string" ? byId.data.role : null;
  return { role: roleValue, error: null };
}

export function isAdminRole(role: string | null | undefined): boolean {
  return String(role ?? "")
    .trim()
    .toLowerCase() === "admin";
}
