import { userIdForDbQuery } from "@/lib/userIdDb";

type SupabaseLike = {
  from: (table: string) => any;
};

function isMissingColumnError(error: { message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("does not exist") || message.includes("could not find"));
}

function parseStatus(value: unknown): string | null {
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function parseIsActive(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export async function isUserAccountActive(
  supabase: SupabaseLike,
  userId: string | number
): Promise<{ active: boolean; status: string | null; error: string | null }> {
  const idKey = userIdForDbQuery(userId);
  const attempts = ["account_status,status,is_active", "account_status,is_active", "status,is_active", "account_status", "status", "is_active"] as const;

  let sawMissingColumn = false;
  for (const select of attempts) {
    const { data, error } = await supabase
      .from("users")
      .select(select)
      .eq("id", idKey)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        sawMissingColumn = true;
        continue;
      }
      return { active: false, status: null, error: error.message || "Could not verify account status." };
    }

    if (!data) {
      return { active: false, status: null, error: "User not found." };
    }

    const isActive = parseIsActive((data as Record<string, unknown>).is_active);
    const accountStatus = parseStatus((data as Record<string, unknown>).account_status);
    const status = accountStatus ?? parseStatus((data as Record<string, unknown>).status);

    if (isActive === false) return { active: false, status: status ?? "inactive", error: null };
    if (status != null) return { active: status === "active", status, error: null };
    return { active: true, status: null, error: null };
  }

  if (sawMissingColumn) {
    // Backward compatibility for older schemas without account-status columns.
    return { active: true, status: null, error: null };
  }

  return { active: false, status: null, error: "Could not verify account status." };
}
