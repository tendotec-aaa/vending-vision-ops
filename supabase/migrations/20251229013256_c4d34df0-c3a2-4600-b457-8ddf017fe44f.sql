-- Create warehouses table
CREATE TABLE public.warehouses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on warehouses
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- RLS policies for warehouses
CREATE POLICY "Admins can manage warehouses"
ON public.warehouses
FOR ALL
USING (
  (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()))
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can view warehouses in their company"
ON public.warehouses
FOR SELECT
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

-- Add weight_kg to products for weight-based fee distribution
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT 0;

-- Add sku to products for SKU generation
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;

-- Create product sub-categories table
CREATE TABLE public.product_subcategories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on product_subcategories
ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_subcategories
CREATE POLICY "Admins can manage subcategories"
ON public.product_subcategories
FOR ALL
USING (
  (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()))
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can view subcategories in their company"
ON public.product_subcategories
FOR SELECT
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

-- Add new fields to purchases table
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'local';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS fee_distribution_method text DEFAULT 'by_value';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS customs_fees numeric DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS handling_fees numeric DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS local_tax_rate numeric DEFAULT 0;

-- Add item-specific fees to purchase_items
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS item_fees numeric DEFAULT 0;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT 0;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS landed_cost numeric DEFAULT 0;

-- Add subcategory_id to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_subcategory_id uuid REFERENCES public.product_subcategories(id);

-- Create trigger for updated_at on warehouses
CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a sequence for SKU generation
CREATE SEQUENCE IF NOT EXISTS public.product_sku_seq START 1;

-- Function to generate SKU
CREATE OR REPLACE FUNCTION public.generate_product_sku(
  p_category_code text,
  p_subcategory_code text,
  p_type_code text
)
RETURNS text
LANGUAGE plpgsql
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