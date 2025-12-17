-- Make toy_id nullable since we've migrated to products table
ALTER TABLE public.visit_report_stock ALTER COLUMN toy_id DROP NOT NULL;

-- Also make replacement_toy_id FK point to products if needed
-- First drop the old FK constraint on replacement_toy_id if it exists
ALTER TABLE public.visit_report_stock DROP CONSTRAINT IF EXISTS visit_report_stock_replacement_toy_id_fkey;