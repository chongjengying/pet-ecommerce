-- Link user_addresses to profiles (and keep user_id for users). Run after profiles + user_addresses exist.
-- Safe to run once; adjust if your table names differ.

alter table public.user_addresses
  add column if not exists profile_id uuid references public.profiles (id) on delete cascade;

update public.user_addresses ua
set profile_id = p.id
from public.profiles p
where p.user_id = ua.user_id
  and ua.profile_id is null;

drop index if exists public.user_addresses_one_default_per_user;

create unique index if not exists user_addresses_one_default_per_profile
  on public.user_addresses (profile_id)
  where is_default = true;

create index if not exists idx_user_addresses_profile_id on public.user_addresses (profile_id);

-- After backfill, enforce NOT NULL (comment out if any orphan rows remain)
-- alter table public.user_addresses alter column profile_id set not null;
