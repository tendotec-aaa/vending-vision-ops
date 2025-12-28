-- Add product_id column to purchase_items to link to products
ALTER TABLE public.purchase_items 
ADD COLUMN product_id uuid REFERENCES public.products(id);

-- Create index for better query performance
CREATE INDEX idx_purchase_items_product_id ON public.purchase_items(product_id);

-- Create a function to update product inventory when purchase items are inserted
CREATE OR REPLACE FUNCTION public.update_product_inventory_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if product_id is set
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET 
      quantity_bodega = quantity_bodega + NEW.quantity,
      quantity_purchased = quantity_purchased + NEW.quantity,
      last_product_purchase = (
        SELECT p.purchase_date 
        FROM public.purchases p 
        WHERE p.id = NEW.purchase_id
      ),
      updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update inventory when purchase item is created
CREATE TRIGGER trigger_update_product_inventory_on_purchase
AFTER INSERT ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.update_product_inventory_on_purchase();