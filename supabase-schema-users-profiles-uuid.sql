-- Canonical schema: users.id and profiles.user_id as UUID, profiles linked 1:1 to users.
-- App reads the shipping table name from env SUPABASE_ADDRESSES_TABLE (default `user_addresses`).
-- If you already use `public.addresses`, set SUPABASE_ADDRESSES_TABLE=addresses and align column names below.
-- Run in Supabase SQL Editor for a new project or after backing up data.
-- If you already use bigint ids, see comments at bottom of this file (manual migration).

create extension if not exists pgcrypto;

-- App-managed users (not Supabase Auth)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text not null unique,
  password text not null,
  full_name text,
  role text not null default 'customer',
  created_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_username on public.users (username);
create index if not exists idx_users_role on public.users (role);

-- One profile row per user (FK + UNIQUE for upsert onConflict user_id)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  username text,
  full_name text,
  avatar_url text,
  phone text,
  gender text,
  dob date,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles (user_id);

-- Saved shipping / billing addresses: child rows of users.
create table if not exists public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null default 'Home',
  recipient_name text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text,
  postal_code text,
  country text not null default 'MY',
  is_default boolean not null default false,
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_addresses_user_id on public.user_addresses (user_id);

-- At most one default address per user (Postgres partial unique index)
create unique index if not exists user_addresses_one_default_per_user
  on public.user_addresses (user_id)
  where is_default = true;

-- Optional: keep profiles.updated_at in sync (reuse if you already have this function)
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.set_user_addresses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_addresses_updated_at on public.user_addresses;
create trigger trg_user_addresses_updated_at
before update on public.user_addresses
for each row
execute function public.set_user_addresses_updated_at();

/*
  Migrating from bigint users.id → uuid (outline only; test on a copy first):
  1) Add users.id_new uuid default gen_random_uuid();
  2) Backfill id_new for all rows;
  3) Add profiles.user_id_new uuid; join update from users;
  4) Drop FKs, swap columns, recreate FKs;
  Or export/import with new schema for small datasets.
*/
