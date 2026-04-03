-- Create a customer profile table for app-managed users.
create table if not exists public.customers (
  id bigserial primary key,
  email text unique,
  username text unique,
  name text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_email on public.customers (email);
create index if not exists idx_customers_username on public.customers (username);
