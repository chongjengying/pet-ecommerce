-- Extra order columns for payment snapshot support.
-- Safe to run multiple times.

alter table public.orders add column if not exists payment_method_code text null;
alter table public.orders add column if not exists payment_provider text null;
alter table public.orders add column if not exists payment_snapshot jsonb null;

create index if not exists idx_orders_payment_method_code
  on public.orders(payment_method_code);

create index if not exists idx_orders_payment_provider
  on public.orders(payment_provider);
