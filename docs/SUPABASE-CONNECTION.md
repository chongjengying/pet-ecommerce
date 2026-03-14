# Supabase connection – what runs and which files

## What happens when you “connect” with the Supabase client

1. **Creating the client** (in code)  
   `createClient(supabaseUrl, supabaseKey)` does **not** call Supabase yet. It only stores the URL and key. No network request at this step.

2. **When you actually talk to Supabase**  
   A request is sent only when you call methods on the client, for example:
   - `supabase.from("products").select("*")`  → GET rows from `products`
   - `supabase.from("products").select("*").eq("id", 1).maybeSingle()`  → GET one row by id  
   So “connecting” in practice = **creating the client** in one file and **using it** in others to run these queries.

---

## Files involved

### 1. Required: create the client (one place)

| File | Purpose |
|------|--------|
| **`src/lib/supabaseClient.ts`** | Creates and exports the Supabase client. Everything that needs Supabase imports from here. |

This file:
- Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or uses fallbacks).
- Calls `createClient(url, key)` and exports `supabase`.

### 2. Optional: environment variables

| File | Purpose |
|------|--------|
| **`.env.local`** | Store your real Supabase URL and anon key so the app uses your project. Copy from `.env.local.example` and fill in. |

If you don’t have `.env.local`, the app can still use the hardcoded fallbacks in `supabaseClient.ts` (if you left them in).

### 3. Files that use the client (call Supabase)

| File | What it does with the client |
|------|------------------------------|
| **`src/app/products/page.tsx`** | `supabase.from("products").select("*")` → list all products. |
| **`src/app/products/[id]/page.tsx`** | `supabase.from("products").select("*").eq("id", idVal).maybeSingle()` → get one product by id. |
| **`src/app/test-db/page.tsx`** | `supabase.from("products").select("*")` → test that products (and names) load. |
| **`src/app/api/supabase-test/route.ts`** | `supabase.from("products").select("id, name, price, image_url")` → API to check connection and product count. |

So: **one file creates the client**, **one optional file configures it**, and **four files use it** to read from the `products` table.

---

## What you need on the Supabase side

- A **`public.products`** table with columns your app expects (e.g. `id`, `name`, `description`, `price`, `stock`, optionally `image_url`).
- **RLS (Row Level Security)** on `products`: if enabled, you need a policy that allows `SELECT` (e.g. “Allow public read access on products” with `USING (true)`), or the app will get 0 rows.

---

## Quick checklist

| Step | File / place | Action |
|------|----------------|--------|
| 1 | `src/lib/supabaseClient.ts` | Already creates client; ensure URL/key are correct or use `.env.local`. |
| 2 | `.env.local` (optional) | Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Dashboard → Project Settings → API. |
| 3 | Supabase Dashboard | Create `products` table; add RLS policy for `SELECT` if RLS is on. |
| 4 | App pages / API | Import `supabase` from `@/lib/supabaseClient` and use `.from("products").select(...)` etc. |

No other files are required to “connect”; the rest only **import** the client and use it.

---

## GitHub: what to commit and what not to

| Do **not** commit (secrets) | Safe to commit |
|-----------------------------|----------------|
| `.env.local` – has real URL and key | `.env.local.example` – template only |
| Any file with real API keys | Supabase client files – they use env vars only |
| | `supabase/migrations/*.sql` – table definitions |
| | All other app and docs files |

`.gitignore` excludes `.env`, `.env.local`, `.env.*.local`. After cloning, copy `.env.local.example` to `.env.local` and add your real values locally.
