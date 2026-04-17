-- Adds account status controls for login gating.
-- Login APIs allow only active users to sign in.

alter table public.users
  add column if not exists status text not null default 'active',
  add column if not exists is_active boolean not null default true;

-- Normalize any existing status values.
update public.users
set status = 'active'
where status is null or btrim(status) = '';

create index if not exists idx_users_status on public.users (status);
create index if not exists idx_users_is_active on public.users (is_active);

-- Optional helper examples:
-- deactivate account
-- update public.users set status = 'inactive', is_active = false where email = 'user@example.com';
-- reactivate account
-- update public.users set status = 'active', is_active = true where email = 'user@example.com';

