-- Create a security definer function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- Drop the problematic profiles policies
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate profiles policies without recursion
CREATE POLICY "Users can view profiles in their company"
ON public.profiles
FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  OR id = auth.uid()
);

CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (id = auth.uid());

-- Fix user_roles policy to avoid potential recursion
DROP POLICY IF EXISTS "Users can view roles in their company" ON public.user_roles;

CREATE POLICY "Users can view roles in their company"
ON public.user_roles
FOR SELECT
USING (
  user_id IN (
    SELECT id 
    FROM public.profiles 
    WHERE company_id = public.get_user_company_id(auth.uid())
  )
);

-- Add trigger to update profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();