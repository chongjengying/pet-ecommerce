-- Fix orders.user_id foreign key to reference public.users(id).
-- Safe to run multiple times.

begin;

do $$
declare
  orders_user_type text;
  users_id_type text;
  fk record;
begin
  if to_regclass('public.orders') is null then
    raise exception 'Table public.orders does not exist.';
  end if;
  if to_regclass('public.users') is null then
    raise exception 'Table public.users does not exist.';
  end if;

  -- Ensure orders.user_id exists; create as text then align to public.users.id type.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'user_id'
  ) then
    alter table public.orders add column user_id text null;
  end if;

  -- Drop any existing FK on orders.user_id.
  for fk in
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'orders'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
  loop
    execute format('alter table public.orders drop constraint if exists %I', fk.constraint_name);
  end loop;

  select pg_catalog.format_type(a.atttypid, a.atttypmod)
    into orders_user_type
  from pg_attribute a
  where a.attrelid = 'public.orders'::regclass
    and a.attname = 'user_id'
    and not a.attisdropped;

  select pg_catalog.format_type(a.atttypid, a.atttypmod)
    into users_id_type
  from pg_attribute a
  where a.attrelid = 'public.users'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  if users_id_type is null then
    raise exception 'Column public.users.id does not exist.';
  end if;

  -- Align orders.user_id type to match public.users.id.
  if users_id_type = 'uuid' and orders_user_type <> 'uuid' then
    execute $sql$
      alter table public.orders
      alter column user_id type uuid
      using case
        when user_id is null then null
        when user_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then user_id::text::uuid
        else null
      end
    $sql$;
  elsif users_id_type in ('bigint', 'integer', 'smallint') and orders_user_type <> users_id_type then
    execute format(
      $sql$
      alter table public.orders
      alter column user_id type %s
      using case
        when user_id is null then null
        when user_id::text ~ '^[0-9]+$' then (user_id::text)::%s
        else null
      end
      $sql$,
      users_id_type,
      users_id_type
    );
  elsif users_id_type not in ('uuid', 'bigint', 'integer', 'smallint') and orders_user_type <> users_id_type then
    execute format(
      'alter table public.orders alter column user_id type %s using user_id::text::%s',
      users_id_type,
      users_id_type
    );
  end if;

  -- Add canonical FK to public.users(id).
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_user'
      and conrelid = 'public.orders'::regclass
  ) then
    execute 'alter table public.orders add constraint fk_user foreign key (user_id) references public.users(id) on delete set null';
  end if;
end $$;

create index if not exists idx_orders_user_id on public.orders(user_id);

commit;
