# Supabase setup

## 1. Fix “unable to connect”

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** (gear) → **API**.
2. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **Project API keys** → either **anon** (long JWT starting with `eyJ...`) or **Publishable** (`sb_publishable_...`)
3. In the app root, create `.env.local` (copy from `.env.local.example`) and set:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... or sb_publishable_...
   ```
4. Restart the dev server (`npm run dev`).
5. In the browser open: **http://localhost:3000/api/supabase-test**  
   - If it returns `{ "ok": true }`, the app is connected.  
   - If not, the JSON will show the exact `error` and `code` (e.g. invalid key, RLS, missing table).

## 2. Create the `products` table

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **SQL Editor**.
3. Copy the contents of `migrations/20250313000000_create_products_table.sql` and run it.

Or with the Supabase CLI (after `supabase link`):

```bash
supabase db push
```

## Table: `public.products`

| Column      | Type                     |
| ----------- | ------------------------ |
| id          | uuid (PK, default random) |
| name        | text (required)          |
| description | text                     |
| price       | numeric (required, ≥ 0)  |
| stock       | int (default 0, ≥ 0)     |
| image_url   | text                     |
| created_at  | timestamptz (default now) |

RLS is enabled; the migration includes a policy so anyone can **read** products. Adjust policies in the SQL file if you need insert/update/delete from the app.
