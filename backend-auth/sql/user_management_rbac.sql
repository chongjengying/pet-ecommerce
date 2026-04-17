-- User management + RBAC schema
-- Safe to run multiple times.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status_enum') then
    create type account_status_enum as enum ('active', 'inactive', 'suspended', 'deleted');
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  account_status account_status_enum not null default 'active',
  is_email_verified boolean not null default false,
  email_verification_token_hash text,
  email_verification_expires timestamptz,
  email_verified_at timestamptz,
  password_updated_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists is_email_verified boolean not null default false,
  add column if not exists email_verification_token_hash text,
  add column if not exists email_verification_expires timestamptz,
  add column if not exists email_verified_at timestamptz,
  add column if not exists password_updated_at timestamptz,
  add column if not exists last_login_at timestamptz;

create table if not exists public.roles (
  id smallserial primary key,
  name text not null unique check (name in ('admin', 'customer')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id smallint not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists idx_users_account_status on public.users(account_status);
create index if not exists idx_users_is_email_verified on public.users(is_email_verified);
create index if not exists idx_users_email_verification_token_hash on public.users(email_verification_token_hash);
create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_user_roles_role_id on public.user_roles(role_id);

insert into public.roles (name) values ('admin') on conflict (name) do nothing;
insert into public.roles (name) values ('customer') on conflict (name) do nothing;

-- Legacy role migration: rename 'user' -> 'customer' if it exists.
do $$
declare
  user_role_id smallint;
  customer_role_id smallint;
begin
  select id into user_role_id from public.roles where name = 'user' limit 1;
  select id into customer_role_id from public.roles where name = 'customer' limit 1;

  if user_role_id is not null and customer_role_id is not null and user_role_id <> customer_role_id then
    insert into public.user_roles (user_id, role_id, created_at)
    select ur.user_id, customer_role_id, now()
    from public.user_roles ur
    where ur.role_id = user_role_id
      and not exists (
        select 1
        from public.user_roles x
        where x.user_id = ur.user_id
          and x.role_id = customer_role_id
      );

    delete from public.user_roles
    where role_id = user_role_id;

    delete from public.roles where id = user_role_id;
  end if;
end $$;

create or replace function public.set_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_users_updated_at();
