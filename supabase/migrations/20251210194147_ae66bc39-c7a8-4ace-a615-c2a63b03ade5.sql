-- Create location_spots table
CREATE TABLE public.location_spots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  spot_number INTEGER NOT NULL,
  place_name TEXT,
  setup_id UUID REFERENCES public.setups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, spot_number)
);

-- Enable RLS
ALTER TABLE public.location_spots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage spots"
ON public.location_spots
FOR ALL
USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can view spots in their company"
ON public.location_spots
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- Add updated_at trigger
CREATE TRIGGER update_location_spots_updated_at
BEFORE UPDATE ON public.location_spots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remove location_id from setups table (setups now link via location_spots.setup_id)
ALTER TABLE public.setups DROP COLUMN IF EXISTS location_id;

-- Migrate existing setup_machines to work with the new structure
-- (No data migration needed since we're removing the column)