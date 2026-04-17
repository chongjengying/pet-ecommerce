-- Payment method catalog + structured payment tracking.
-- Safe to run repeatedly in Supabase SQL Editor.

create table if not exists public.payment_methods (
  code text primary key,
  display_name text not null,
  provider text not null,
  category text not null default 'gateway'
    check (category in ('gateway', 'bnpl', 'bank_transfer')),
  description text null,
  logo_key text null,
  supported_brands jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_payment_methods_provider_code
  on public.payment_methods(provider, code);

create index if not exists idx_payment_methods_active_sort
  on public.payment_methods(is_active, sort_order, display_name);

create or replace function public.set_payment_methods_updated_at()
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
execute function public.set_payment_methods_updated_at();

insert into public.payment_methods (
  code,
  display_name,
  provider,
  category,
  description,
  logo_key,
  supported_brands,
  sort_order,
  is_active,
  metadata
)
values
  (
    'adaptis_gateway',
    'ADAPTIS Payment Gateway (formerly iPay88)',
    'adaptis',
    'gateway',
    'Redirects the customer to ADAPTIS to complete payment.',
    'adaptis',
    '["VISA","MC","FPX","TnG"]'::jsonb,
    10,
    true,
    '{"redirect": true, "supports_card": true, "supports_fpx": true}'::jsonb
  ),
  (
    'grab',
    'Grab',
    'grab',
    'bnpl',
    'Pay today or later at 0% interest.',
    'grab',
    '["Grab","VISA","MC","AMEX"]'::jsonb,
    20,
    true,
    '{"redirect": true, "supports_bnpl": true}'::jsonb
  ),
  (
    'bank_transfer',
    'Cash Deposit / Online Transfer',
    'bank_transfer',
    'bank_transfer',
    'Manual transfer or cash deposit with bank proof upload later.',
    'bank_transfer',
    '[]'::jsonb,
    30,
    true,
    '{"manual_review": true}'::jsonb
  )
on conflict (code) do update set
  display_name = excluded.display_name,
  provider = excluded.provider,
  category = excluded.category,
  description = excluded.description,
  logo_key = excluded.logo_key,
  supported_brands = excluded.supported_brands,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  metadata = excluded.metadata;

alter table public.payments
  add column if not exists payment_method_code text null,
  add column if not exists payment_provider text null,
  add column if not exists payment_channel text null,
  add column if not exists payment_method_snapshot jsonb null;

alter table public.payments
  drop constraint if exists payments_payment_method_code_fkey;

alter table public.payments
  add constraint payments_payment_method_code_fkey
  foreign key (payment_method_code)
  references public.payment_methods(code)
  on delete set null;

create index if not exists idx_payments_payment_method_code
  on public.payments(payment_method_code);

create index if not exists idx_payments_payment_provider
  on public.payments(payment_provider);

create index if not exists idx_payments_payment_channel
  on public.payments(payment_channel);

-- Optional order-side projection for easier reporting and dashboards.
alter table public.orders
  add column if not exists payment_method_code text null,
  add column if not exists payment_provider text null,
  add column if not exists payment_snapshot jsonb null;

alter table public.orders
  drop constraint if exists orders_payment_method_code_fkey;

alter table public.orders
  add constraint orders_payment_method_code_fkey
  foreign key (payment_method_code)
  references public.payment_methods(code)
  on delete set null;

create index if not exists idx_orders_payment_method_code
  on public.orders(payment_method_code);

create index if not exists idx_orders_payment_provider
  on public.orders(payment_provider);

