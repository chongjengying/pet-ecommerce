-- Email verification columns for existing users table.
-- Safe to run multiple times.

alter table if exists public.users
  add column if not exists is_email_verified boolean not null default false,
  add column if not exists email_verification_token_hash text,
  add column if not exists email_verification_expires timestamptz,
  add column if not exists email_verified_at timestamptz;

create index if not exists idx_users_is_email_verified on public.users(is_email_verified);
create index if not exists idx_users_email_verification_token_hash on public.users(email_verification_token_hash);
