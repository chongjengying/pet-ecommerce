-- Runtime column patch for current app code.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- Orders: current checkout/order code writes these payment snapshot fields.
alter table public.orders add column if not exists payment_method_code text null;
alter table public.orders add column if not exists payment_provider text null;
alter table public.orders add column if not exists payment_snapshot jsonb null;

create index if not exists idx_orders_payment_method_code
  on public.orders(payment_method_code);

create index if not exists idx_orders_payment_provider
  on public.orders(payment_provider);

-- Payments: current code writes legacy transaction/review fields that may not exist yet.
alter table public.payments add column if not exists user_id text null;
alter table public.payments add column if not exists transaction_id text null;
alter table public.payments add column if not exists reference_no text null;
alter table public.payments add column if not exists payment_method text null;
alter table public.payments add column if not exists review_status text null;
alter table public.payments add column if not exists reviewed_by text null;
alter table public.payments add column if not exists reviewed_at timestamptz null;
alter table public.payments add column if not exists notes text null;

create index if not exists idx_payments_user_id
  on public.payments(user_id);

create index if not exists idx_payments_transaction_id
  on public.payments(transaction_id);

create index if not exists idx_payments_reference_no
  on public.payments(reference_no);

create index if not exists idx_payments_review_status
  on public.payments(review_status);
