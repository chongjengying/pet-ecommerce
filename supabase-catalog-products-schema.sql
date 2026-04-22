-- Catalog schema based on requested columns.
-- Safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null,
  short_description text null,
  category_id uuid not null,
  brand_id uuid null,
  status text not null default 'draft',
  featured boolean not null default false,
  thumbnail_url text null,
  seo_title text null,
  seo_description text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_products_status_check check (status in ('draft', 'active', 'archived'))
);

-- Bring existing tables up to date without failing if some columns already exist.
alter table public.catalog_products add column if not exists short_description text null;
alter table public.catalog_products add column if not exists category_id uuid null;
alter table public.catalog_products add column if not exists brand_id uuid null;
alter table public.catalog_products add column if not exists status text null;
alter table public.catalog_products add column if not exists featured boolean not null default false;
alter table public.catalog_products add column if not exists thumbnail_url text null;
alter table public.catalog_products add column if not exists seo_title text null;
alter table public.catalog_products add column if not exists seo_description text null;
alter table public.catalog_products add column if not exists created_by uuid null;
alter table public.catalog_products add column if not exists created_at timestamptz not null default now();
alter table public.catalog_products add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_products_status_check'
      and conrelid = 'public.catalog_products'::regclass
  ) then
    alter table public.catalog_products
      add constraint catalog_products_status_check
      check (status in ('draft', 'active', 'archived')) not valid;
  end if;
end $$;

-- Add indexes only when columns exist (helps mixed/legacy schemas).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_products' and column_name = 'status'
  ) then
    execute 'create index if not exists idx_catalog_products_status on public.catalog_products (status)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_products' and column_name = 'featured'
  ) then
    execute 'create index if not exists idx_catalog_products_featured on public.catalog_products (featured)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_products' and column_name = 'category_id'
  ) then
    execute 'create index if not exists idx_catalog_products_category_id on public.catalog_products (category_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_products' and column_name = 'brand_id'
  ) then
    execute 'create index if not exists idx_catalog_products_brand_id on public.catalog_products (brand_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_products' and column_name = 'created_at'
  ) then
    execute 'create index if not exists idx_catalog_products_created_at_desc on public.catalog_products (created_at desc)';
  end if;
end $$;

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists trg_brands_updated_at on public.brands;
create trigger trg_brands_updated_at
before update on public.brands
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists trg_catalog_products_updated_at on public.catalog_products;
create trigger trg_catalog_products_updated_at
before update on public.catalog_products
for each row
execute function public.set_timestamp_updated_at();

-- Add FKs only when referenced columns are UUID to avoid type mismatch failures.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catalog_products'
      and column_name = 'category_id'
      and udt_name = 'uuid'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categories'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) then
    alter table public.catalog_products
      drop constraint if exists catalog_products_category_id_fkey,
      add constraint catalog_products_category_id_fkey
      foreign key (category_id) references public.categories(id) on delete restrict;
  else
    raise notice 'Skipped FK catalog_products.category_id -> categories.id because categories.id is not UUID.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catalog_products'
      and column_name = 'brand_id'
      and udt_name = 'uuid'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'brands'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) then
    alter table public.catalog_products
      drop constraint if exists catalog_products_brand_id_fkey,
      add constraint catalog_products_brand_id_fkey
      foreign key (brand_id) references public.brands(id) on delete set null;
  else
    raise notice 'Skipped FK catalog_products.brand_id -> brands.id because brands.id is not UUID.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catalog_products'
      and column_name = 'created_by'
      and udt_name = 'uuid'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) then
    alter table public.catalog_products
      drop constraint if exists catalog_products_created_by_fkey,
      add constraint catalog_products_created_by_fkey
      foreign key (created_by) references public.profiles(id) on delete set null;
  else
    raise notice 'Skipped FK catalog_products.created_by -> profiles.id because profiles.id is not UUID.';
  end if;
end $$;

-- Optional: public read policy for active products.
alter table public.catalog_products enable row level security;

drop policy if exists "Public can read active catalog products" on public.catalog_products;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_products' and column_name = 'status'
  ) then
    create policy "Public can read active catalog products"
      on public.catalog_products
      for select
      using (status = 'active');
  else
    raise notice 'Skipped policy creation: public.catalog_products.status not found';
  end if;
end $$;
