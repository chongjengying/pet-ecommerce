-- Requested performance indexes
-- cart_items(cart_id)
-- order_items(order_id)
-- orders(user_id, created_at)
-- orders(status)
-- products(category_id)
-- catalog_products(category_id)
-- Safe to run multiple times.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cart_items' and column_name = 'cart_id'
  ) then
    execute 'create index if not exists idx_cart_items_cart_id_req on public.cart_items (cart_id)';
  else
    raise notice 'Skipped idx_cart_items_cart_id_req: public.cart_items.cart_id not found';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'order_id'
  ) then
    execute 'create index if not exists idx_order_items_order_id_req on public.order_items (order_id)';
  else
    raise notice 'Skipped idx_order_items_order_id_req: public.order_items.order_id not found';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'user_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'created_at'
  ) then
    execute 'create index if not exists idx_orders_user_created_at_req on public.orders (user_id, created_at desc)';
  else
    raise notice 'Skipped idx_orders_user_created_at_req: public.orders.user_id or created_at not found';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'status'
  ) then
    execute 'create index if not exists idx_orders_status_req on public.orders (status)';
  else
    raise notice 'Skipped idx_orders_status_req: public.orders.status not found';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'category_id'
  ) then
    execute 'create index if not exists idx_products_category_id_req on public.products (category_id)';
  else
    raise notice 'Skipped idx_products_category_id_req: public.products.category_id not found';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_products' and column_name = 'category_id'
  ) then
    execute 'create index if not exists idx_catalog_products_category_id_req on public.catalog_products (category_id)';
  else
    raise notice 'Skipped idx_catalog_products_category_id_req: public.catalog_products.category_id not found';
  end if;
end $$;
