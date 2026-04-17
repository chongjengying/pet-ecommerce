import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { userIdForDbQuery } from "@/lib/userIdDb";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";

export async function GET() {
  const gate = await verifyAdminAccess();
  if (!gate.ok) {
    return adminAccessDeniedResponse(gate);
  }

  const { userId } = gate;

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server not configured." },
      { status: 503 }
    );
  }

  const idKey = userIdForDbQuery(userId);

  const selects = ["id,email,username", "id,email"] as const;
  let data: Record<string, unknown> | null = null;
  let lastError = "";

  for (const select of selects) {
    const result = await supabase.from("users").select(select).eq("id", idKey).maybeSingle();
    if (!result.error) {
      data = (result.data as Record<string, unknown> | null) ?? null;
      break;
    }
    const message = result.error.message || "Could not load admin user.";
    const lower = message.toLowerCase();
    const isMissingColumn = lower.includes("column") && (lower.includes("does not exist") || lower.includes("could not find"));
    if (!isMissingColumn) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    lastError = message;
  }

  if (!data) {
    return NextResponse.json({ error: lastError || "User not found." }, { status: 404 });
  }

  const row = data as { id?: unknown; email?: unknown; username?: unknown };
  const email = typeof row.email === "string" ? row.email : null;
  const username =
    typeof row.username === "string"
      ? row.username
      : email && email.includes("@")
      ? email.split("@")[0]
      : null;
  return NextResponse.json({
    id: row.id != null ? String(row.id) : userId,
    email,
    username,
  });
}
