-- Add start_date to locations
ALTER TABLE public.locations ADD COLUMN start_date date;

-- Add model column to machines
ALTER TABLE public.machines ADD COLUMN model text;

-- Add setup_type to setups
ALTER TABLE public.setups ADD COLUMN setup_type text;

-- Add position column to setup_machines (left, center, right)
ALTER TABLE public.setup_machines ADD COLUMN position text;