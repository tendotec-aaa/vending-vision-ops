-- Add new fields to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS company_email text,
ADD COLUMN IF NOT EXISTS tax_id text;

-- Add phone_number to profiles table for employee tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_number text;