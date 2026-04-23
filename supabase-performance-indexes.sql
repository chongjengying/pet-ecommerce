-- High-impact, low-risk indexes for product listing/search and cart operations.
-- Safe to run multiple times.

create extension if not exists pg_trgm;

-- Products: case-insensitive name search with ILIKE '%keyword%'.
create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);

-- Product images: primary image lookup for listing/PDP.
create index if not exists idx_product_images_product_id_main_sort
  on public.product_images(product_id, is_main desc, sort_order asc);

-- Cart: fast per-user active cart lookup.
create index if not exists idx_cart_user_status_created
  on public.cart(user_id, status, created_at desc);

-- Cart items: fast upsert/select by cart + product.
create unique index if not exists idx_cart_items_cart_product_unique
  on public.cart_items(cart_id, product_id);

-- Cart items: fast joins and quantity updates.
create index if not exists idx_cart_items_cart_id
  on public.cart_items(cart_id);

create index if not exists idx_cart_items_product_id
  on public.cart_items(product_id);
