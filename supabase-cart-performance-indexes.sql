-- Cart performance + tally consistency hardening
-- Run this in Supabase SQL editor.

begin;

-- 1) Cleanup duplicates that break tally (keep oldest row id per cart+product).
with ranked as (
  select
    id,
    row_number() over (partition by cart_id, product_id order by id asc) as rn
  from public.cart_items
)
delete from public.cart_items ci
using ranked r
where ci.id = r.id
  and r.rn > 1;

-- 2) Strong indexes for cart lookups and add-to-cart mutation path.
create index if not exists idx_cart_user_id_created_at_desc
  on public.cart (user_id, created_at desc);

create index if not exists idx_cart_items_cart_id
  on public.cart_items (cart_id);

create index if not exists idx_cart_items_cart_product
  on public.cart_items (cart_id, product_id);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'product_images'
  ) then
    create index if not exists idx_product_images_product_main_sort
      on public.product_images (product_id, is_main desc, sort_order asc, created_at asc);
  end if;
end $$;

-- 3) Enforce one row per cart+product to prevent future drift.
create unique index if not exists uq_cart_items_cart_product
  on public.cart_items (cart_id, product_id);

commit;
