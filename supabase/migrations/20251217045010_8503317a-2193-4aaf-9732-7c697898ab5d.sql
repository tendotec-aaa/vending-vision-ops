-- Add product_name column to visit_report_stock for readability
ALTER TABLE public.visit_report_stock
ADD COLUMN IF NOT EXISTS product_name text;

-- Add product_name column to toy_movements for readability
ALTER TABLE public.toy_movements
ADD COLUMN IF NOT EXISTS product_name text;