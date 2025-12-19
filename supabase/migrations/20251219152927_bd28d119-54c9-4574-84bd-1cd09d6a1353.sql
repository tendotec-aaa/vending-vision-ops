-- Restructure machine_toy_movements table to match exact specification
-- First, drop the existing table and recreate with exact columns in order

DROP TABLE IF EXISTS public.machine_toy_movements;

CREATE TABLE public.machine_toy_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_report_id UUID NOT NULL REFERENCES public.visit_reports(id),
  machine_toy_slot_id UUID REFERENCES public.machine_toy_slots(id),
  company_id UUID NOT NULL,
  employee_id UUID REFERENCES auth.users(id),
  location_id UUID REFERENCES public.locations(id),
  spot_id UUID REFERENCES public.location_spots(id),
  setup_id UUID REFERENCES public.setups(id),
  employee_name_snapshot TEXT,
  location_name_snapshot TEXT,
  spot_name_snapshot TEXT,
  movement_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  toy_name_snapshot TEXT,
  movement_description TEXT
);

-- Enable RLS
ALTER TABLE public.machine_toy_movements ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY "Users can create movements in their company" 
ON public.machine_toy_movements 
FOR INSERT 
WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view movements in their company" 
ON public.machine_toy_movements 
FOR SELECT 
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));