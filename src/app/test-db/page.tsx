import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * Test page: can we get products (including name) from Supabase?
 * Open http://localhost:3000/test-db to verify.
 */
export default async function TestDbPage() {
  const { data: products, error } = await supabase.from("products").select("*");

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <h1 className="text-2xl font-bold text-red-600">Database test failed</h1>
        <p className="text-umber/80">Error: {error.message}</p>
        <p className="text-sm text-umber/60">Code: {error.code}</p>
      </div>
    );
  }

  const list = products ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-bold text-umber">Test: Get products from Supabase</h1>

      {list.length === 0 ? (
        <>
          <p className="text-amber-700 font-medium">
            No rows returned. Your table has data but the app sees 0 rows — usually this is RLS
            (Row Level Security) blocking reads.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="mb-2 font-semibold text-umber">Fix: run this in Supabase</p>
            <p className="mb-2 text-sm text-umber/70">
              Dashboard → SQL Editor → New query → paste and run:
            </p>
            <pre className="overflow-x-auto rounded bg-umber/5 p-3 text-sm text-umber">
{`-- Allow anyone to read products (so your app can show them)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on products" ON public.products;
CREATE POLICY "Allow public read access on products"
  ON public.products FOR SELECT
  USING (true);`}
            </pre>
            <p className="mt-2 text-sm text-umber/60">
              Then refresh this page (F5) — you should see your product name(s).
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="text-sage font-medium">
            Found {list.length} product(s) from the database. Names below:
          </p>
          <ul className="space-y-4">
            {list.map((p) => (
              <li
                key={String(p.id)}
                className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold text-umber">Name: {String((p as Record<string, unknown>).name ?? "(empty)")}</p>
                <p className="mt-1 text-sm text-umber/70">ID: {String(p.id)}</p>
                <p className="text-sm text-umber/70">
                  Price: {(p as Record<string, unknown>).price != null ? `$${Number((p as Record<string, unknown>).price)}` : "—"}
                </p>
                {(p as Record<string, unknown>).description != null && (
                  <p className="mt-1 text-sm text-umber/60">
                    Description: {String((p as Record<string, unknown>).description)}
                  </p>
                )}
                {(p as Record<string, unknown>).stock != null && (
                  <p className="text-sm text-umber/60">Stock: {String((p as Record<string, unknown>).stock)}</p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-sage">
            ✓ You see product names from Supabase — the app is reading correctly.
          </p>
        </>
      )}
    </div>
  );
}
