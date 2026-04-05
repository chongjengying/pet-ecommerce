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

  const { data, error } = await supabase
    .from("users")
    .select("id, email, username")
    .eq("id", idKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "Could not load admin user." }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const row = data as { id?: unknown; email?: unknown; username?: unknown };
  return NextResponse.json({
    id: row.id != null ? String(row.id) : userId,
    email: typeof row.email === "string" ? row.email : null,
    username: typeof row.username === "string" ? row.username : null,
  });
}
