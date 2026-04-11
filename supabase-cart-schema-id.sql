-- Canonical cart schema
-- cart(id, user_id, created_at)
-- cart_items(id, cart_id, product_id, quantity, price_at_time)
--
-- Safe migration notes:
-- 1) Keeps legacy columns if they exist, but migrates data into canonical columns.
-- 2) Ensures primary keys on cart.id and cart_items.id.
-- 3) Adds helpful indexes.

begin;

create table if not exists public.cart (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id bigserial primary key,
  cart_id bigint not null references public.cart (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  product_name text null,
  sku text null,
  quantity integer not null default 1 check (quantity > 0),
  price_at_time numeric(12,2) not null check (price_at_time >= 0)
);

do $$
declare
  cart_pk_name text;
  cart_items_pk_name text;
begin
  -- cart: ensure canonical columns
  alter table public.cart add column if not exists id bigint;
  alter table public.cart add column if not exists user_id uuid;
  alter table public.cart add column if not exists created_at timestamptz default now();

  -- migrate old cart.cart_id -> cart.id (if old column exists)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'cart' and column_name = 'cart_id'
  ) then
    execute '
      update public.cart
      set id = case
        when id is null and cart_id::text ~ ''^[0-9]+$'' then cart_id::bigint
        else id
      end
      where id is null
    ';
  end if;

  -- assign id sequence/default for any missing ids
  execute 'create sequence if not exists public.cart_id_seq';
  execute 'alter sequence public.cart_id_seq owned by public.cart.id';
  execute 'alter table public.cart alter column id set default nextval(''public.cart_id_seq'')';
  execute 'update public.cart set id = nextval(''public.cart_id_seq'') where id is null';
  execute 'alter table public.cart alter column id set not null';

  -- reset sequence to max(id)
  execute '
    select setval(
      ''public.cart_id_seq'',
      greatest((select coalesce(max(id), 0) from public.cart), 1),
      true
    )
  ';

  -- replace primary key with cart.id
  select conname into cart_pk_name
  from pg_constraint
  where conrelid = 'public.cart'::regclass and contype = 'p'
  limit 1;

  if cart_pk_name is not null then
    execute format('alter table public.cart drop constraint %I', cart_pk_name);
  end if;

  alter table public.cart add constraint cart_pkey primary key (id);

  -- cart_items: ensure canonical columns
  alter table public.cart_items add column if not exists id bigint;
  alter table public.cart_items add column if not exists cart_id bigint;
  alter table public.cart_items add column if not exists product_id bigint;
  alter table public.cart_items add column if not exists product_name text;
  alter table public.cart_items add column if not exists sku text;
  alter table public.cart_items add column if not exists quantity integer default 1;
  alter table public.cart_items add column if not exists price_at_time numeric(12,2) default 0;

  -- migrate old cart_items.cart_item_id -> cart_items.id (if old column exists)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'cart_items' and column_name = 'cart_item_id'
  ) then
    execute '
      update public.cart_items
      set id = case
        when id is null and cart_item_id::text ~ ''^[0-9]+$'' then cart_item_id::bigint
        else id
      end
      where id is null
    ';
  end if;

  execute 'create sequence if not exists public.cart_items_id_seq';
  execute 'alter sequence public.cart_items_id_seq owned by public.cart_items.id';
  execute 'alter table public.cart_items alter column id set default nextval(''public.cart_items_id_seq'')';
  execute 'update public.cart_items set id = nextval(''public.cart_items_id_seq'') where id is null';
  execute 'alter table public.cart_items alter column id set not null';

  execute '
    select setval(
      ''public.cart_items_id_seq'',
      greatest((select coalesce(max(id), 0) from public.cart_items), 1),
      true
    )
  ';

  select conname into cart_items_pk_name
  from pg_constraint
  where conrelid = 'public.cart_items'::regclass and contype = 'p'
  limit 1;

  if cart_items_pk_name is not null then
    execute format('alter table public.cart_items drop constraint %I', cart_items_pk_name);
  end if;

  alter table public.cart_items add constraint cart_items_pkey primary key (id);
end $$;

-- canonical constraints/indexes
alter table public.cart
  alter column user_id set not null;

alter table public.cart_items
  alter column cart_id set not null,
  alter column product_id set not null,
  alter column quantity set not null,
  alter column price_at_time set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cart_items_cart_id_fkey'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items
      add constraint cart_items_cart_id_fkey
      foreign key (cart_id) references public.cart (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cart_items_product_id_fkey'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items
      add constraint cart_items_product_id_fkey
      foreign key (product_id) references public.products (id) on delete cascade;
  end if;
end $$;

create index if not exists idx_cart_user_id_created_at
  on public.cart (user_id, created_at desc);

create index if not exists idx_cart_items_cart_id
  on public.cart_items (cart_id);

create index if not exists idx_cart_items_product_id
  on public.cart_items (product_id);

create unique index if not exists uq_cart_items_cart_product
  on public.cart_items (cart_id, product_id);

commit;
