-- Restructure visit_reports table to match exact specification
-- First, add new columns
ALTER TABLE public.visit_reports
ADD COLUMN IF NOT EXISTS setup_id UUID REFERENCES public.setups(id),
ADD COLUMN IF NOT EXISTS employee_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS location_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS spot_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS total_cash_collected NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_units_sold INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_units_refilled INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_units_removed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_units_surplus_shortage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_issues_reported INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Drop columns that are no longer needed
ALTER TABLE public.visit_reports
DROP COLUMN IF EXISTS access_notes,
DROP COLUMN IF EXISTS coin_box_notes,
DROP COLUMN IF EXISTS jam_status,
DROP COLUMN IF EXISTS has_observation,
DROP COLUMN IF EXISTS is_jammed,
DROP COLUMN IF EXISTS last_visit_id,
DROP COLUMN IF EXISTS last_visit_date_snapshot,
DROP COLUMN IF EXISTS days_since_last_visit,
DROP COLUMN IF EXISTS spot_rent_monthly_snapshot,
DROP COLUMN IF EXISTS spot_rent_daily_snapshot,
DROP COLUMN IF EXISTS rent_expense_calculated,
DROP COLUMN IF EXISTS rent_calculated,
DROP COLUMN IF EXISTS time_in,
DROP COLUMN IF EXISTS time_out,
DROP COLUMN IF EXISTS photo_url,
DROP COLUMN IF EXISTS total_cash_removed;