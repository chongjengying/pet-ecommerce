-- Align public.user_addresses with the current Address Book page + API.
-- Safe to run on an existing project.
--
-- Why no RLS here?
-- This app uses a server-side Supabase service role plus a custom customer JWT,
-- so normal `auth.uid()`-based RLS policies would not match your app users table.
-- Address updates are already scoped in the API by `.eq('user_id', currentUserId)`.

alter table public.user_addresses
  add column if not exists recipient_name text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists is_default_shipping boolean not null default false,
  add column if not exists is_default_billing boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_addresses'
      and column_name = 'line1'
  ) then
    execute '
      update public.user_addresses
      set address_line1 = coalesce(address_line1, line1)
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_addresses'
      and column_name = 'line2'
  ) then
    execute '
      update public.user_addresses
      set address_line2 = coalesce(address_line2, line2)
    ';
  end if;
end $$;

update public.user_addresses
set
  is_default_shipping = coalesce(is_default_shipping, is_default),
  is_default_billing = coalesce(is_default_billing, is_default)
where true;

create index if not exists idx_user_addresses_default_shipping
  on public.user_addresses (user_id)
  where is_default_shipping = true;

create index if not exists idx_user_addresses_default_billing
  on public.user_addresses (user_id)
  where is_default_billing = true;
