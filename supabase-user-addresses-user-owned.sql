-- Make user_addresses use only `user_id` as the foreign key owner.
-- Run this on an existing project if you no longer want `profile_id` in the table.

alter table public.user_addresses
  drop constraint if exists user_addresses_profile_id_fkey;

drop index if exists public.idx_user_addresses_profile_id;
drop index if exists public.user_addresses_one_default_per_profile;

alter table public.user_addresses
  drop column if exists profile_id;

create unique index if not exists user_addresses_one_default_per_user
  on public.user_addresses (user_id)
  where is_default = true;
