-- Drop the foreign key constraint on toy_id since we're using products table now
ALTER TABLE public.visit_report_stock DROP CONSTRAINT IF EXISTS visit_report_stock_toy_id_fkey;