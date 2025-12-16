-- Add toy_current_stock to machine_toy_slots
ALTER TABLE public.machine_toy_slots 
ADD COLUMN IF NOT EXISTS toy_current_stock integer DEFAULT 0;

-- Create product_categories table for user-defined categories
CREATE TABLE public.product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories in their company" 
ON public.product_categories FOR SELECT 
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage categories" 
ON public.product_categories FOR ALL 
USING ((company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

-- Create unified products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  product_name text NOT NULL,
  product_category_id uuid REFERENCES public.product_categories(id),
  product_type text NOT NULL CHECK (product_type IN ('Toys', 'Spare Parts', 'Stickers', 'Other')),
  product_type_other text,
  last_product_purchase date,
  cogs numeric NOT NULL DEFAULT 0,
  quantity_purchased integer NOT NULL DEFAULT 0,
  quantity_bodega integer NOT NULL DEFAULT 0,
  quantity_in_machines integer NOT NULL DEFAULT 0,
  quantity_sold integer NOT NULL DEFAULT 0,
  quantity_surplus_shortage integer NOT NULL DEFAULT 0,
  total_sales_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products in their company" 
ON public.products FOR SELECT 
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage products" 
ON public.products FOR ALL 
USING ((company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate data from toys table to products
INSERT INTO public.products (company_id, product_name, product_type, cogs, quantity_bodega, created_at)
SELECT company_id, name, 'Toys', cogs, 0, created_at
FROM public.toys;

-- Migrate data from warehouse_finished_products to products (as Toys type)
INSERT INTO public.products (company_id, product_name, product_type, cogs, quantity_bodega, created_at)
SELECT company_id, name, 'Toys', final_cogs, quantity, created_at
FROM public.warehouse_finished_products
ON CONFLICT DO NOTHING;

-- Update machine_toy_slots to reference products instead of toys
ALTER TABLE public.machine_toy_slots 
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);

-- Update visit_report_stock to reference products
ALTER TABLE public.visit_report_stock 
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);