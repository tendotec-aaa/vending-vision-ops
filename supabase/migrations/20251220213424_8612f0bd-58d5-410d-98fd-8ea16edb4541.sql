-- Drop and recreate visit_report_stock table with exact columns specified

-- First drop the table completely
DROP TABLE IF EXISTS public.visit_report_stock CASCADE;

-- Create the new table with exact column order
CREATE TABLE public.visit_report_stock (
    -- THE LINKS (IDs)
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL,
    employee_id UUID,
    visit_report_id UUID NOT NULL REFERENCES public.visit_reports(id) ON DELETE CASCADE,
    machine_toy_slot_id UUID REFERENCES public.machine_toy_slots(id),
    machine_id UUID REFERENCES public.machines(id),
    toy_id UUID,
    location_id UUID REFERENCES public.locations(id),
    location_spot_id UUID REFERENCES public.location_spots(id),
    replacement_toy_id UUID,
    
    -- THE SNAPSHOTS (Text)
    location_name_snapshot TEXT,
    spot_name_snapshot TEXT,
    machine_serial_snapshot TEXT,
    toy_name_snapshot TEXT,
    slot_position_snapshot TEXT,
    replacement_toy_name TEXT,
    
    -- THE MONEY & MATH
    unit_price_snapshot NUMERIC,
    cost_per_unit_snapshot NUMERIC,
    units_sold INTEGER DEFAULT 0,
    total_revenue NUMERIC DEFAULT 0,
    
    -- THE OPERATIONS
    units_refilled INTEGER DEFAULT 0,
    units_removed INTEGER DEFAULT 0,
    capacity_snapshot INTEGER,
    days_since_last_refill INTEGER,
    
    -- THE ISSUES & AUDITS
    units_audited INTEGER,
    units_shortage_surplus INTEGER DEFAULT 0,
    has_issue BOOLEAN DEFAULT false,
    jam_type TEXT,
    issue_severity TEXT,
    reported_issue TEXT,
    reported_issue_photo_url TEXT,
    is_being_replaced BOOLEAN DEFAULT false,
    
    -- METADATA
    visit_type TEXT,
    visit_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visit_report_stock ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view stock in their company reports" 
ON public.visit_report_stock 
FOR SELECT 
USING (visit_report_id IN (
    SELECT id FROM public.visit_reports 
    WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
));

CREATE POLICY "Users can create stock for their reports" 
ON public.visit_report_stock 
FOR INSERT 
WITH CHECK (visit_report_id IN (
    SELECT id FROM public.visit_reports 
    WHERE employee_id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_visit_report_stock_visit_report_id ON public.visit_report_stock(visit_report_id);
CREATE INDEX idx_visit_report_stock_company_id ON public.visit_report_stock(company_id);
CREATE INDEX idx_visit_report_stock_machine_toy_slot_id ON public.visit_report_stock(machine_toy_slot_id);
CREATE INDEX idx_visit_report_stock_machine_id ON public.visit_report_stock(machine_id);
CREATE INDEX idx_visit_report_stock_visit_date ON public.visit_report_stock(visit_date);