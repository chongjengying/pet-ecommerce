import { NextResponse } from "next/server";
import { adminAccessDeniedResponse, verifyAdminAccess } from "@/lib/adminGate";
import { getServerWriteClient } from "@/lib/adminProductMutations";

const ROLE_VALUES = new Set(["admin", "customer"]);
const STATUS_VALUES = new Set(["active", "inactive", "suspended", "deleted"]);

function normalizeStatus(row: Record<string, unknown>): string {
  const accountStatus = typeof row.account_status === "string" ? row.account_status.trim().toLowerCase() : "";
  if (accountStatus) return accountStatus;
  const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
  if (status) return status;
  if (typeof row.is_active === "boolean") return row.is_active ? "active" : "inactive";
  return "active";
}

function normalizeRole(row: Record<string, unknown>): string {
  const role = typeof row.role === "string" ? row.role.trim().toLowerCase() : "";
  return role === "admin" ? "admin" : "customer";
}

async function selectUsersSafely() {
  const db = getServerWriteClient();
  const selects = [
    "id,email,username,role,status,is_active,account_status,created_at,updated_at",
    "id,email,username,role,status,is_active,created_at,updated_at",
    "id,email,username,role,status,created_at,updated_at",
    "id,email,username,role,created_at,updated_at",
    "id,email,username,created_at,updated_at",
  ] as const;

  let lastError = "";
  for (const select of selects) {
    const { data, error } = await db.from("users").select(select).order("created_at", { ascending: false });
    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      return rows.map((row) => {
        const r = row as unknown as Record<string, unknown>;
        return {
          id: String(r.id ?? ""),
          email: typeof r.email === "string" ? r.email : "",
          username: typeof r.username === "string" ? r.username : "",
          role: normalizeRole(r),
          status: normalizeStatus(r),
          created_at: typeof r.created_at === "string" ? r.created_at : null,
          updated_at: typeof r.updated_at === "string" ? r.updated_at : null,
        };
      });
    }
    lastError = typeof error.message === "string" ? error.message : "Could not query users.";
  }

  throw new Error(lastError || "Could not query users.");
}

async function insertUserSafely(payload: Record<string, unknown>, requiredColumns: string[]) {
  const db = getServerWriteClient();
  const body: Record<string, unknown> = { ...payload };

  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await db.from("users").insert(body).select("id").single();
    if (!error) return data;

    const message = typeof error.message === "string" ? error.message : "Could not create user.";
    const missing = message.match(/Could not find the '([^']+)' column/i)?.[1];
    if (!missing || !(missing in body)) throw new Error(message);
    if (requiredColumns.includes(missing)) {
      throw new Error(`Users table is missing required column '${missing}'.`);
    }
    delete body[missing];
  }

  throw new Error("Could not create user due to schema mismatch.");
}

export async function GET() {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const users = await selectUsersSafely();
    return NextResponse.json({ success: true, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const gate = await verifyAdminAccess();
  if (!gate.ok) return adminAccessDeniedResponse(gate);

  try {
    const body = (await request.json()) as {
      email?: string;
      username?: string;
      password?: string;
      role?: string;
      status?: string;
    };

    const email = String(body.email ?? "").trim().toLowerCase();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "customer").trim().toLowerCase();
    const status = String(body.status ?? "active").trim().toLowerCase();

    if (!email || !username || !password) {
      return NextResponse.json({ error: "Email, username, and password are required." }, { status: 400 });
    }
    if (!ROLE_VALUES.has(role)) {
      return NextResponse.json({ error: "Role must be admin or customer." }, { status: 400 });
    }
    if (!STATUS_VALUES.has(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    await insertUserSafely(
      {
        email,
        username,
        password,
        role,
        status,
        account_status: status,
        is_active: status === "active" || status === "inactive",
      },
      ["email", "username", "password"]
    );

    const users = await selectUsersSafely();
    return NextResponse.json({ success: true, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
