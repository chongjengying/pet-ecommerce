create table if not exists public.vouchers (
  id bigserial primary key,
  code text not null,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('fixed','percentage','free_shipping')),
  discount_value numeric(12,2) not null default 0,
  max_discount_amount numeric(12,2),
  min_order_amount numeric(12,2) not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  per_user_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_vouchers_code_lower on public.vouchers (lower(code));

create table if not exists public.voucher_rules (
  id bigserial primary key,
  voucher_id bigint not null references public.vouchers(id) on delete cascade,
  rule_type text not null check (rule_type in ('product','category','brand','user_group','payment_method')),
  operator text not null check (operator in ('include','exclude')),
  value text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.voucher_redemptions (
  id bigserial primary key,
  voucher_id bigint not null references public.vouchers(id),
  voucher_code text not null,
  user_id uuid,
  order_id uuid references public.orders(id),
  discount_amount numeric(12,2) not null default 0,
  status text not null check (status in ('reserved','used','cancelled','refunded')),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_voucher_redemptions_voucher_user on public.voucher_redemptions(voucher_id, user_id, status);
create index if not exists idx_voucher_redemptions_order_id on public.voucher_redemptions(order_id);

alter table public.orders add column if not exists voucher_id bigint references public.vouchers(id);
alter table public.orders add column if not exists voucher_code text;
alter table public.orders add column if not exists voucher_discount_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists subtotal_amount numeric(12,2);
alter table public.orders add column if not exists shipping_amount numeric(12,2);
alter table public.orders add column if not exists total_amount numeric(12,2);

update public.orders
set
  subtotal_amount = coalesce(subtotal_amount, subtotal, 0),
  shipping_amount = coalesce(shipping_amount, shipping_fee, 0),
  tax_amount = coalesce(tax_amount, 0),
  total_amount = coalesce(total_amount, subtotal + coalesce(shipping_fee,0) + coalesce(tax_amount,0) - coalesce(discount,0));

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_vouchers_updated_at on public.vouchers;
create trigger trg_vouchers_updated_at
before update on public.vouchers
for each row execute function public.touch_updated_at();

drop trigger if exists trg_voucher_redemptions_updated_at on public.voucher_redemptions;
create trigger trg_voucher_redemptions_updated_at
before update on public.voucher_redemptions
for each row execute function public.touch_updated_at();

create or replace function public.increment_voucher_used_count(p_voucher_id bigint)
returns void
language plpgsql
as $$
begin
  update public.vouchers
  set used_count = used_count + 1
  where id = p_voucher_id
    and (usage_limit is null or used_count < usage_limit);
end;
$$;
