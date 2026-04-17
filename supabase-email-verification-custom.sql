-- Custom email verification columns for public.users
-- Safe to run multiple times.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash text NULL,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS email_verification_used_at timestamptz NULL;

-- Ensure token hash is fast to look up.
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
  ON public.users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;

-- Optional: speed up case-insensitive email lookups for resend/login flows.
CREATE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (lower(email));
