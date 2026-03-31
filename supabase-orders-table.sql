-- Run this in Supabase Dashboard → SQL Editor.
-- This script is idempotent and upgrades existing schema to the redesigned order model.

create sequence if not exists order_number_seq;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique default ('ORD-' || lpad(nextval('order_number_seq')::text, 6, '0')),
  created_at timestamptz not null default now(),
  status text not null default 'completed',
  user_id uuid null references auth.users(id) on delete set null,
  subtotal numeric not null default 0 check (subtotal >= 0),
  shipping_fee numeric not null default 0 check (shipping_fee >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  currency text not null default 'MYR',
  notes text null,
  metadata jsonb null
);

-- Backfill/upgrade for existing orders table
alter table orders add column if not exists order_number text;
alter table orders add column if not exists user_id uuid null references auth.users(id) on delete set null;
alter table orders add column if not exists subtotal numeric not null default 0;
alter table orders add column if not exists shipping_fee numeric not null default 0;
alter table orders add column if not exists tax_amount numeric not null default 0;
alter table orders add column if not exists total_amount numeric not null default 0;
alter table orders add column if not exists currency text not null default 'MYR';
alter table orders add column if not exists notes text null;
alter table orders add column if not exists metadata jsonb null;
alter table orders drop column if exists discount_total;

alter table orders alter column order_number set default ('ORD-' || lpad(nextval('order_number_seq')::text, 6, '0'));

update orders
set order_number = ('ORD-' || lpad(nextval('order_number_seq')::text, 6, '0'))
where order_number is null or order_number = '';

create unique index if not exists idx_orders_order_number_unique on orders(order_number);
create index if not exists idx_orders_created_at_desc on orders(created_at desc);
create index if not exists idx_orders_user_created_at on orders(user_id, created_at desc);
create index if not exists idx_orders_status on orders(status);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id integer not null,
  product_name text not null default 'Product',
  product_sku text null,
  unit_price numeric not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  metadata jsonb null
);

-- Backfill/upgrade for existing order_items table
alter table order_items add column if not exists product_name text not null default 'Product';
alter table order_items add column if not exists product_sku text null;
alter table order_items add column if not exists unit_price numeric not null default 0;
alter table order_items add column if not exists metadata jsonb null;
alter table order_items drop column if exists line_subtotal;

-- If older schema used "name" and "price", copy data into new columns.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'name'
  ) then
    execute 'update order_items set product_name = coalesce(nullif(product_name, ''''), name, ''Product'')';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'price'
  ) then
    execute 'update order_items set unit_price = coalesce(unit_price, price, 0)';
  end if;
end $$;

create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_order_items_product_id on order_items(product_id);

create table if not exists inventory_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_id integer not null,
  order_id uuid null references orders(id) on delete set null,
  order_number text null,
  action text not null default 'decrement',
  quantity integer not null check (quantity > 0),
  stock_before integer not null,
  stock_after integer not null,
  note text null
);

create index if not exists idx_inventory_logs_created_at on inventory_logs(created_at desc);
create index if not exists idx_inventory_logs_product_id on inventory_logs(product_id);
create index if not exists idx_inventory_logs_order_id on inventory_logs(order_id);

alter table orders enable row level security;
alter table order_items enable row level security;
alter table inventory_logs enable row level security;

drop policy if exists "Allow anon insert orders" on orders;
drop policy if exists "Allow anon select orders" on orders;
drop policy if exists "Allow anon insert order_items" on order_items;
drop policy if exists "Allow anon select order_items" on order_items;
drop policy if exists "Allow anon insert inventory_logs" on inventory_logs;
drop policy if exists "Allow anon select inventory_logs" on inventory_logs;

create policy "Allow anon insert orders"
  on orders for insert
  to anon
  with check (true);

create policy "Allow anon select orders"
  on orders for select
  to anon
  using (true);

create policy "Allow anon insert order_items"
  on order_items for insert
  to anon
  with check (true);

create policy "Allow anon select order_items"
  on order_items for select
  to anon
  using (true);

create policy "Allow anon insert inventory_logs"
  on inventory_logs for insert
  to anon
  with check (true);

create policy "Allow anon select inventory_logs"
  on inventory_logs for select
  to anon
  using (true);
