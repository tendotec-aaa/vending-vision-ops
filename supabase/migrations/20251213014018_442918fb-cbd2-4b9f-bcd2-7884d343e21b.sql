-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
BEGIN
  -- Create a new company for the user
  INSERT INTO public.companies (name)
  VALUES (COALESCE(new.raw_user_meta_data ->> 'company_name', 'My Company'))
  RETURNING id INTO new_company_id;

  -- Create profile for the user
  INSERT INTO public.profiles (id, email, first_name, last_name, company_id)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new_company_id
  );

  -- Assign admin role to the new user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'admin');

  RETURN new;
END;
$$;

-- Create trigger to run on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();