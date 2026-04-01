-- Run once in Supabase → SQL Editor so admin + storefront can persist PDP fields.
-- Without these columns, POST/PUT still succeed but Supabase drops unknown keys (benefit, etc.).
-- Safe to re-run: uses IF NOT EXISTS.

alter table public.products add column if not exists size_label text null;
alter table public.products add column if not exists size text null;
alter table public.products add column if not exists item_size text null;
alter table public.products add column if not exists color text null;
alter table public.products add column if not exists benefit text null;
alter table public.products add column if not exists ingredients text null;
alter table public.products add column if not exists feeding_instructions text null;
