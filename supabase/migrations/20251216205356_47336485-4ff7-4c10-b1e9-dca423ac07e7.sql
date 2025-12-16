-- Add new columns to visit_reports for enhanced functionality
ALTER TABLE public.visit_reports
ADD COLUMN IF NOT EXISTS visit_type text DEFAULT 'routine',
ADD COLUMN IF NOT EXISTS time_in timestamp with time zone,
ADD COLUMN IF NOT EXISTS time_out timestamp with time zone,
ADD COLUMN IF NOT EXISTS access_notes text,
ADD COLUMN IF NOT EXISTS coin_box_notes text,
ADD COLUMN IF NOT EXISTS total_cash_removed numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS spot_id uuid REFERENCES public.location_spots(id),
ADD COLUMN IF NOT EXISTS is_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS general_notes text;

-- Add new columns to visit_report_stock for detailed tracking
ALTER TABLE public.visit_report_stock
ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES public.machines(id),
ADD COLUMN IF NOT EXISTS slot_number integer,
ADD COLUMN IF NOT EXISTS units_sold integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS units_refilled integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS units_removed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS audited_count integer,
ADD COLUMN IF NOT EXISTS discrepancy integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_issue boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS issue_description text,
ADD COLUMN IF NOT EXISTS issue_severity text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_visit_reports_spot_id ON public.visit_reports(spot_id);
CREATE INDEX IF NOT EXISTS idx_visit_reports_visit_date ON public.visit_reports(visit_date);
CREATE INDEX IF NOT EXISTS idx_visit_report_stock_machine_id ON public.visit_report_stock(machine_id);