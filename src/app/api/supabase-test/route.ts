import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * GET /api/supabase-test
 * Call this to see the real Supabase connection error (e.g. in browser or Network tab).
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(using fallback URL)";
  const hasKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, image_url");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "Supabase returned an error",
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          config: { url, hasEnvKey: hasKey },
        },
        { status: 502 }
      );
    }

    const rows = data ?? [];
    return NextResponse.json({
      ok: true,
      message: "Connected to Supabase",
      productCount: rows.length,
      products: rows,
      config: { url, hasEnvKey: hasKey },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        message: "Connection failed",
        error: message,
        config: { url, hasEnvKey: hasKey },
      },
      { status: 503 }
    );
  }
}
