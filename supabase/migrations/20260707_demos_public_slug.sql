-- Fix: Add missing public_slug column to demos table
-- This column is required by the app code but was never created in the database.
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/tqsksxxmkjnqfakkeyaf/sql

ALTER TABLE public.demos
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE;

COMMENT ON COLUMN public.demos.public_slug IS 'Short random slug for shareable demo preview URLs (e.g. /d/abc123)';
