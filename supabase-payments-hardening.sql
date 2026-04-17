-- Optional hardening for existing `payments` table.
-- Safe to run repeatedly.

alter table public.payments
  alter column currency set default 'MYR',
  alter column refund_amount set default 0;

create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_review_status on public.payments(review_status);
create index if not exists idx_payments_created_at on public.payments(created_at desc);
create index if not exists idx_payments_reference_no on public.payments(reference_no);
create index if not exists idx_payments_transaction_id on public.payments(transaction_id);

create or replace function public.set_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
before update on public.payments
for each row
execute function public.set_payments_updated_at();

