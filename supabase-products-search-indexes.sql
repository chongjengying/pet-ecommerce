-- Product search/performance indexes for storefront and admin list views.
-- Safe to run multiple times.

create extension if not exists pg_trgm;

create index if not exists idx_products_name on public.products (name);
create index if not exists idx_products_price on public.products (price);
create index if not exists idx_products_stock on public.products (stock);

-- Helpful when sorting/filtering by latest products.
create index if not exists idx_products_id_desc on public.products (id desc);

-- Fast partial text search on product names.
create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);

-- Only create category indexes if those columns exist in the current schema.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'category'
  ) then
    execute 'create index if not exists idx_products_category on public.products (category)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'category_id'
  ) then
    execute 'create index if not exists idx_products_category_id on public.products (category_id)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'categoryid'
  ) then
    execute 'create index if not exists idx_products_categoryid on public.products (categoryid)';
  end if;
end $$;

-- Product gallery lookup optimization (used by product listing/details).
create index if not exists idx_product_images_product_sort
  on public.product_images (product_id, is_main desc, sort_order asc);
