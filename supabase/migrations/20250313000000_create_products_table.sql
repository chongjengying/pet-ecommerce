-- Create products table in Supabase (PostgreSQL)
-- Run this in Supabase Dashboard → SQL Editor, or via Supabase CLI: supabase db push

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

-- Optional: enable Row Level Security (RLS) and allow public read for product listing
alter table public.products enable row level security;

create policy "Allow public read access on products"
  on public.products
  for select
  using (true);

-- Optional: allow authenticated users or service role to insert/update/delete
-- Uncomment and adjust if you need write access from the app:
-- create policy "Allow authenticated insert"
--   on public.products for insert with check (true);
-- create policy "Allow authenticated update"
--   on public.products for update using (true);
-- create policy "Allow authenticated delete"
--   on public.products for delete using (true);

comment on table public.products is 'Pet shop products (food, toys, etc.)';
