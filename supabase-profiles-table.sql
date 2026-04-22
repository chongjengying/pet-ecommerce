-- Profile details table for customer accounts.
-- NOTE: For new installs prefer `supabase-schema-users-profiles-uuid.sql` (UUID ids, `profiles.user_id` → `users.id`, `user_addresses`).
-- Keep account identity in `users`, and personal details in `profiles`.
create table if not exists public.profiles (
  id bigserial primary key,
  user_id bigint not null unique references public.users(id) on delete cascade,
  username text,
  first_name text,
  last_name text,
  full_name text,
  avatar_url text,
  phone text,
  gender text,
  dob date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

create index if not exists idx_profiles_user_id on public.profiles (user_id);

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
