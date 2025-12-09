-- Create machine_toy_slots table to track which toys are in which machine slots
CREATE TABLE public.machine_toy_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  toy_id uuid REFERENCES public.toys(id) ON DELETE SET NULL,
  slot_number integer NOT NULL CHECK (slot_number >= 1 AND slot_number <= 8),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (machine_id, slot_number)
);

-- Enable RLS
ALTER TABLE public.machine_toy_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view toy slots in their company"
ON public.machine_toy_slots
FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage toy slots"
ON public.machine_toy_slots
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'admin')
);

-- Add updated_at trigger
CREATE TRIGGER update_machine_toy_slots_updated_at
BEFORE UPDATE ON public.machine_toy_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key from setups to locations for better querying
ALTER TABLE public.setups 
ADD CONSTRAINT setups_location_id_fkey 
FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;

-- Add foreign key from setup_machines
ALTER TABLE public.setup_machines
ADD CONSTRAINT setup_machines_setup_id_fkey
FOREIGN KEY (setup_id) REFERENCES public.setups(id) ON DELETE CASCADE;

ALTER TABLE public.setup_machines
ADD CONSTRAINT setup_machines_machine_id_fkey
FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;