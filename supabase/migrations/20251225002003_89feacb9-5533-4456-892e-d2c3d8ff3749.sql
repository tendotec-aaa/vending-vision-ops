
-- Function to add stock to bodega for a product
CREATE OR REPLACE FUNCTION public.add_stock_to_bodega(
  p_product_id UUID,
  p_quantity INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate quantity
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;
  
  -- Update product quantities
  UPDATE products
  SET 
    quantity_bodega = quantity_bodega + p_quantity,
    quantity_purchased = quantity_purchased + p_quantity,
    updated_at = now()
  WHERE id = p_product_id;
  
  -- Check if product was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
END;
$$;
