import { userIdForDbQuery } from "@/lib/userIdDb";

type SupabaseLike = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string | number) => PromiseLike<{ error: { message?: string } | null }> | { error: { message?: string } | null };
    };
  };
};

function isMissingColumnError(error: { message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("does not exist") || message.includes("could not find"));
}

export async function updateUserLastLoginAt(
  supabase: SupabaseLike,
  userId: string | number
): Promise<{ error: string | null }> {
  const idKey = userIdForDbQuery(userId);
  const { error } = await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", idKey);

  if (!error || isMissingColumnError(error)) {
    return { error: null };
  }

  return { error: error.message || "Could not update last login time." };
}
