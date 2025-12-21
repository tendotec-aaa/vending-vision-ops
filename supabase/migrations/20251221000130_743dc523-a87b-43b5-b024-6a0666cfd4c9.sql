-- Fix visit-photos bucket security
-- 1. Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'visit-photos';

-- 2. Drop existing policies that don't validate company ownership
DROP POLICY IF EXISTS "Users can view visit photos in their company" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company visit photos" ON storage.objects;

-- 3. Create new RLS policies that properly validate company ownership via folder path
-- SELECT policy - users can only view photos in their company's folder
CREATE POLICY "Users can view visit photos in their company"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'visit-photos' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- INSERT policy - users can only upload to their company's folder
CREATE POLICY "Users can upload visit photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'visit-photos' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- UPDATE policy - users can only update photos in their company's folder
CREATE POLICY "Users can update their company visit photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'visit-photos' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- DELETE policy - users can only delete photos in their company's folder
CREATE POLICY "Users can delete their company visit photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'visit-photos' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);