-- 1. Update Profiles Table with new fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS employee_id text,
ADD COLUMN IF NOT EXISTS drivers_license_number text,
ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS assigned_territory text,
ADD COLUMN IF NOT EXISTS emergency_contact_name text,
ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS vehicle_assigned text,
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';

-- 2. Update Companies Table with new fields
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS legal_business_name text,
ADD COLUMN IF NOT EXISTS support_email text,
ADD COLUMN IF NOT EXISTS support_phone text,
ADD COLUMN IF NOT EXISTS billing_currency text DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS fiscal_year_start date,
ADD COLUMN IF NOT EXISTS brand_color text,
ADD COLUMN IF NOT EXISTS logo_url text;