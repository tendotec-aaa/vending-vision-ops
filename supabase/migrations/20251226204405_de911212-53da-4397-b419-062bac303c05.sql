-- Add setup_id, machine_id and human-readable snapshot columns to work_orders
ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS setup_id uuid REFERENCES public.setups(id),
ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES public.machines(id),
ADD COLUMN IF NOT EXISTS location_name_snapshot text,
ADD COLUMN IF NOT EXISTS spot_name_snapshot text,
ADD COLUMN IF NOT EXISTS setup_name_snapshot text,
ADD COLUMN IF NOT EXISTS machine_serial_snapshot text,
ADD COLUMN IF NOT EXISTS employee_id uuid,
ADD COLUMN IF NOT EXISTS employee_name_snapshot text,
ADD COLUMN IF NOT EXISTS visit_report_id uuid REFERENCES public.visit_reports(id),
ADD COLUMN IF NOT EXISTS visit_date_snapshot timestamp with time zone,
ADD COLUMN IF NOT EXISTS slot_number_snapshot integer,
ADD COLUMN IF NOT EXISTS toy_name_snapshot text;