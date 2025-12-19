-- 1. UPDATE 'machine_toy_slots' (Live Shelf)
ALTER TABLE public.machine_toy_slots
ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id),
ADD COLUMN IF NOT EXISTS location_spot_id uuid REFERENCES public.location_spots(id),
ADD COLUMN IF NOT EXISTS location_name_snapshot text,
ADD COLUMN IF NOT EXISTS location_spot_name_snapshot text,
ADD COLUMN IF NOT EXISTS toy_name_cached text,
ADD COLUMN IF NOT EXISTS machine_serial_cached text,
ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS last_refill_date timestamp with time zone;

-- 2. UPDATE 'visit_report_stock' (Detailed Receipt)
ALTER TABLE public.visit_report_stock
ADD COLUMN IF NOT EXISTS location_spot_id uuid REFERENCES public.location_spots(id),
ADD COLUMN IF NOT EXISTS location_spot_name_snapshot text,
ADD COLUMN IF NOT EXISTS replacement_toy_name text,
ADD COLUMN IF NOT EXISTS toy_name_snapshot text,
ADD COLUMN IF NOT EXISTS machine_serial_snapshot text,
ADD COLUMN IF NOT EXISTS location_name_snapshot text,
ADD COLUMN IF NOT EXISTS slot_position_snapshot text,
ADD COLUMN IF NOT EXISTS unit_price_snapshot numeric,
ADD COLUMN IF NOT EXISTS visit_type text,
ADD COLUMN IF NOT EXISTS reported_issue text,
ADD COLUMN IF NOT EXISTS is_being_replaced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS units_shortage_surplus integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS units_audited integer,
ADD COLUMN IF NOT EXISTS machine_toy_slot_id uuid REFERENCES public.machine_toy_slots(id);

-- 3. RENAME 'toy_movements' to 'machine_toy_movements' and add columns
ALTER TABLE IF EXISTS public.toy_movements RENAME TO machine_toy_movements;

ALTER TABLE public.machine_toy_movements
ADD COLUMN IF NOT EXISTS toy_id uuid REFERENCES public.toys(id),
ADD COLUMN IF NOT EXISTS location_spot_name_snapshot text,
ADD COLUMN IF NOT EXISTS toy_name_snapshot text,
ADD COLUMN IF NOT EXISTS movement_description text,
ADD COLUMN IF NOT EXISTS movement_date timestamp with time zone;

-- 4. UPDATE 'visit_reports' (Parent Table)
ALTER TABLE public.visit_reports
ADD COLUMN IF NOT EXISTS visit_summary text, 
ADD COLUMN IF NOT EXISTS total_current_stock integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_toy_capacity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_visit_id uuid,
ADD COLUMN IF NOT EXISTS last_visit_date_snapshot timestamp with time zone,
ADD COLUMN IF NOT EXISTS days_since_last_visit integer,
ADD COLUMN IF NOT EXISTS spot_rent_monthly_snapshot numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS spot_rent_daily_snapshot numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS rent_expense_calculated numeric DEFAULT 0;