-- Add slots_per_machine column to machines table
ALTER TABLE public.machines 
ADD COLUMN slots_per_machine integer NOT NULL DEFAULT 8;