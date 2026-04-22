-- Optional hardening for existing `payments` table.
-- Safe to run repeatedly, and safe on partial schemas.

do $$
begin
  if to_regclass('public.payments') is null then
    raise notice 'Skipped hardening: public.payments does not exist.';
    return;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'currency'
  ) then
    execute 'alter table public.payments alter column currency set default ''MYR''';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'refund_amount'
  ) then
    execute 'alter table public.payments alter column refund_amount set default 0';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'order_id'
  ) then
    execute 'create index if not exists idx_payments_order_id on public.payments(order_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'user_id'
  ) then
    execute 'create index if not exists idx_payments_user_id on public.payments(user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'status'
  ) then
    execute 'create index if not exists idx_payments_status on public.payments(status)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'review_status'
  ) then
    execute 'create index if not exists idx_payments_review_status on public.payments(review_status)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'created_at'
  ) then
    execute 'create index if not exists idx_payments_created_at on public.payments(created_at desc)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'reference_no'
  ) then
    execute 'create index if not exists idx_payments_reference_no on public.payments(reference_no)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'transaction_id'
  ) then
    execute 'create index if not exists idx_payments_transaction_id on public.payments(transaction_id)';
  end if;
end $$;

create or replace function public.set_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.payments') is null then
    raise notice 'Skipped payments updated_at trigger: public.payments does not exist.';
    return;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'updated_at'
  ) then
    execute 'drop trigger if exists trg_payments_updated_at on public.payments';
    execute 'create trigger trg_payments_updated_at before update on public.payments for each row execute function public.set_payments_updated_at()';
  else
    raise notice 'Skipped payments updated_at trigger: updated_at column not found.';
  end if;
end $$;
