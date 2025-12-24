-- Remove the foreign key constraint from machine_toy_slots.toy_id to toys table
-- The system now uses the products table instead of toys table

ALTER TABLE public.machine_toy_slots 
DROP CONSTRAINT IF EXISTS machine_toy_slots_toy_id_fkey;