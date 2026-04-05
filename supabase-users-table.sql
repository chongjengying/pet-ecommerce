-- Custom users table for app-managed auth (not Supabase Auth).
-- NOTE: For new installs prefer `supabase-schema-users-profiles-uuid.sql` (UUID primary keys + linked profiles + addresses).
-- Password is stored as plain text for now (not recommended for production).
create table if not exists public.users (
  id bigserial primary key,
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
