-- Restructure machine_toy_slots table to match exact specification

-- First, drop any dependent views or functions that might reference this table
-- The trigger function will be updated separately

-- Add new columns first
ALTER TABLE public.machine_toy_slots 
ADD COLUMN IF NOT EXISTS employee_id UUID,
ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC DEFAULT 1.00;

-- Rename columns to match specification
ALTER TABLE public.machine_toy_slots 
RENAME COLUMN location_spot_id TO spot_id;

ALTER TABLE public.machine_toy_slots 
RENAME COLUMN toy_current_stock TO current_stock;

-- Drop columns that are not in the specification
ALTER TABLE public.machine_toy_slots 
DROP COLUMN IF EXISTS created_at,
DROP COLUMN IF EXISTS updated_at,
DROP COLUMN IF EXISTS location_name_snapshot,
DROP COLUMN IF EXISTS location_spot_name_snapshot,
DROP COLUMN IF EXISTS product_id,
DROP COLUMN IF EXISTS toy_capacity;

-- Update foreign key constraints
ALTER TABLE public.machine_toy_slots
DROP CONSTRAINT IF EXISTS machine_toy_slots_location_spot_id_fkey;

ALTER TABLE public.machine_toy_slots
ADD CONSTRAINT machine_toy_slots_spot_id_fkey 
FOREIGN KEY (spot_id) REFERENCES public.location_spots(id) ON DELETE SET NULL;

-- Set default for current_stock if null
UPDATE public.machine_toy_slots SET current_stock = 0 WHERE current_stock IS NULL;
UPDATE public.machine_toy_slots SET capacity = 15 WHERE capacity IS NULL;
UPDATE public.machine_toy_slots SET price_per_unit = 1.00 WHERE price_per_unit IS NULL;

-- Add NOT NULL constraints where appropriate
ALTER TABLE public.machine_toy_slots 
ALTER COLUMN current_stock SET DEFAULT 0,
ALTER COLUMN capacity SET DEFAULT 15,
ALTER COLUMN price_per_unit SET DEFAULT 1.00;