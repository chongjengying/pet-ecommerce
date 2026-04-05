-- Fix Postgres error:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Cause: Supabase/PostgREST upsert with { onConflict: "user_id" } requires a UNIQUE
-- constraint (or PRIMARY KEY) on public.profiles.user_id.
--
-- Run this in the Supabase SQL Editor if your profiles table was created without
-- UNIQUE on user_id, or if you only have a non-unique index.
--
-- 1) If you already have duplicate user_id rows, fix data first, e.g.:
--    DELETE FROM public.profiles p
--    USING public.profiles p2
--    WHERE p.user_id = p2.user_id AND p.id > p2.id;
--
-- 2) Add the unique constraint (skip if it already exists).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
