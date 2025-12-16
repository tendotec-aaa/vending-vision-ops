-- Add toy_capacity to machine_toy_slots for capacity tracking
ALTER TABLE public.machine_toy_slots
ADD COLUMN IF NOT EXISTS toy_capacity integer DEFAULT 20;

-- Add jam tracking fields to visit_report_stock
ALTER TABLE public.visit_report_stock
ADD COLUMN IF NOT EXISTS jam_type text,
ADD COLUMN IF NOT EXISTS is_replacing_toy boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS replacement_toy_id uuid REFERENCES public.toys(id),
ADD COLUMN IF NOT EXISTS removed_for_replacement integer DEFAULT 0;

-- Create storage bucket for visit report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for visit photos bucket
CREATE POLICY "Users can view visit photos in their company"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'visit-photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can upload visit photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'visit-photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own visit photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'visit-photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);