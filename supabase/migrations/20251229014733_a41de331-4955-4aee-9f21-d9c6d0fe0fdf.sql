-- Rename weight_kg to cbm in products table
ALTER TABLE public.products RENAME COLUMN weight_kg TO cbm;

-- Rename weight_kg to cbm in purchase_items table
ALTER TABLE public.purchase_items RENAME COLUMN weight_kg TO cbm;

-- Remove the single item_fees column from purchase_items (will use separate table)
ALTER TABLE public.purchase_items DROP COLUMN IF EXISTS item_fees;

-- Remove fee_distribution_method from purchases (each fee will have its own)
ALTER TABLE public.purchases DROP COLUMN IF EXISTS fee_distribution_method;

-- Remove old individual fee columns from purchases (will use purchase_global_fees table)
ALTER TABLE public.purchases DROP COLUMN IF EXISTS shipping_cost;
ALTER TABLE public.purchases DROP COLUMN IF EXISTS customs_fees;
ALTER TABLE public.purchases DROP COLUMN IF EXISTS handling_fees;
ALTER TABLE public.purchases DROP COLUMN IF EXISTS duties_taxes;

-- Create purchase_global_fees table for global fees with independent distribution methods
CREATE TABLE public.purchase_global_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  fee_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  distribution_method text NOT NULL DEFAULT 'by_value',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create purchase_item_fees table for multiple item-specific fees
CREATE TABLE public.purchase_item_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_item_id uuid NOT NULL REFERENCES public.purchase_items(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  fee_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.purchase_global_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_item_fees ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_global_fees
CREATE POLICY "Admins can manage global fees" 
ON public.purchase_global_fees 
FOR ALL 
USING ((company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view global fees in their company" 
ON public.purchase_global_fees 
FOR SELECT 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS policies for purchase_item_fees
CREATE POLICY "Admins can manage item fees" 
ON public.purchase_item_fees 
FOR ALL 
USING ((company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view item fees in their company" 
ON public.purchase_item_fees 
FOR SELECT 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));