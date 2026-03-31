import { NextResponse } from "next/server";

// Lightweight endpoint used by an external scheduler to keep the app awake.
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}

