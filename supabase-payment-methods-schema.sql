-- Payment methods + payments schema.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (
    code in (
      'card',
      'paypal',
      'apple_pay',
      'google_pay',
      'cod',
      'bank_transfer'
    )
  ),
  name text not null,
  provider text not null check (
    provider in (
      'stripe',
      'paypal',
      'manual'
    )
  ),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_methods_active_sort
  on public.payment_methods(is_active, sort_order);

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payment_methods_updated_at on public.payment_methods;
create trigger trg_payment_methods_updated_at
before update on public.payment_methods
for each row
execute function public.set_timestamp_updated_at();

insert into public.payment_methods (code, name, provider, is_active, sort_order)
values
  ('card', 'Credit/Debit Card', 'stripe', true, 10),
  ('paypal', 'PayPal', 'paypal', true, 20),
  ('apple_pay', 'Apple Pay', 'stripe', true, 30),
  ('google_pay', 'Google Pay', 'stripe', true, 40),
  ('cod', 'Cash on Delivery', 'manual', true, 50),
  ('bank_transfer', 'Bank Transfer', 'manual', true, 60)
on conflict (code) do update
set
  name = excluded.name,
  provider = excluded.provider,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null,
  payment_method_id uuid null,

  provider text not null check (
    provider in ('stripe', 'paypal')
  ),

  transaction_reference text null,
  payment_intent_reference text null,
  provider_customer_reference text null,

  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'MYR',

  status text not null default 'pending' check (
    status in (
      'pending',
      'authorized',
      'paid',
      'failed',
      'refunded',
      'partially_refunded'
    )
  ),

  failure_reason text null,
  gateway_response jsonb null,
  refund_amount numeric(12,2) not null default 0,
  refunded_at timestamptz null,
  receipt_url text null,
  metadata jsonb null,

  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
before update on public.payments
for each row
execute function public.set_timestamp_updated_at();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'order_id'
      and udt_name = 'uuid'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) then
    alter table public.payments
      drop constraint if exists payments_order_id_fkey,
      add constraint payments_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete cascade;
  else
    raise notice 'Skipped payments_order_id_fkey: orders.id or payments.order_id is missing/not uuid.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'payment_method_id'
      and udt_name = 'uuid'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_methods'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) then
    alter table public.payments
      drop constraint if exists payments_payment_method_id_fkey,
      add constraint payments_payment_method_id_fkey
      foreign key (payment_method_id) references public.payment_methods(id) on delete set null;
  else
    raise notice 'Skipped payments_payment_method_id_fkey: payment_methods.id or payments.payment_method_id is missing/not uuid.';
  end if;
end $$;

create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_payment_method_id on public.payments(payment_method_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_created_at_desc on public.payments(created_at desc);
