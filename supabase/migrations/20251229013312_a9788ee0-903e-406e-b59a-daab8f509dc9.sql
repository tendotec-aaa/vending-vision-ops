-- Fix function search path for generate_product_sku
CREATE OR REPLACE FUNCTION public.generate_product_sku(
  p_category_code text,
  p_subcategory_code text,
  p_type_code text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_seq integer;
BEGIN
  v_seq := nextval('public.product_sku_seq');
  RETURN UPPER(COALESCE(p_category_code, 'XX')) || '-' || 
         UPPER(COALESCE(p_subcategory_code, 'XX')) || '-' || 
         UPPER(COALESCE(p_type_code, 'XX')) || '-' || 
         LPAD(v_seq::text, 5, '0');
END;
$function$;