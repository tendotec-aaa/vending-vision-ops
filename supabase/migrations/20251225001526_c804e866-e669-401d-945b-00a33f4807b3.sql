
-- Function to update product stats from visit report
CREATE OR REPLACE FUNCTION public.update_product_stats_from_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    slot_item JSONB;
    v_product_id UUID;
    v_units_sold INTEGER;
    v_units_refilled INTEGER;
    v_units_removed INTEGER;
    v_discrepancy INTEGER;
    v_price_per_unit NUMERIC;
    v_current_stock INTEGER;
BEGIN
    IF NEW.slot_performance_snapshot IS NULL THEN
        RETURN NEW;
    END IF;

    -- Process each slot in the snapshot
    FOR slot_item IN SELECT * FROM jsonb_array_elements(NEW.slot_performance_snapshot)
    LOOP
        -- Get product_id (from product_id or toy_id for backward compatibility)
        v_product_id := COALESCE(
            (slot_item->>'product_id')::uuid,
            (slot_item->>'toy_id')::uuid
        );
        
        -- Skip if no product
        IF v_product_id IS NULL THEN
            CONTINUE;
        END IF;
        
        v_units_sold := COALESCE((slot_item->>'units_sold')::int, 0);
        v_units_refilled := COALESCE((slot_item->>'units_refilled')::int, 0);
        v_units_removed := COALESCE((slot_item->>'units_removed')::int, 0);
        v_discrepancy := COALESCE((slot_item->>'discrepancy')::int, (slot_item->>'units_shortage_surplus')::int, 0);
        v_price_per_unit := COALESCE((slot_item->>'price_per_unit')::numeric, (slot_item->>'unit_price_snapshot')::numeric, 1.00);
        v_current_stock := COALESCE((slot_item->>'current_stock')::int, 0);
        
        -- Update product stats
        UPDATE public.products
        SET 
            quantity_sold = quantity_sold + v_units_sold,
            quantity_in_machines = quantity_in_machines + v_units_refilled - v_units_sold - v_units_removed,
            quantity_bodega = quantity_bodega - v_units_refilled + v_units_removed,
            quantity_surplus_shortage = quantity_surplus_shortage + v_discrepancy,
            total_sales_amount = total_sales_amount + (v_units_sold * v_price_per_unit),
            updated_at = now()
        WHERE id = v_product_id;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Create trigger for updating product stats
DROP TRIGGER IF EXISTS update_product_stats_trigger ON public.visit_reports;
CREATE TRIGGER update_product_stats_trigger
AFTER INSERT ON public.visit_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_product_stats_from_visit();

-- Function to recalculate all product stats from movements (for manual sync)
CREATE OR REPLACE FUNCTION public.recalculate_product_stats(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_product RECORD;
    v_sold INTEGER;
    v_refilled INTEGER;
    v_removed INTEGER;
    v_surplus INTEGER;
    v_shortage INTEGER;
    v_in_machines INTEGER;
BEGIN
    -- Loop through all products for this company
    FOR v_product IN SELECT id, quantity_purchased FROM products WHERE company_id = p_company_id
    LOOP
        -- Calculate sold from movements
        SELECT COALESCE(SUM(ABS(quantity)), 0) INTO v_sold
        FROM machine_toy_movements
        WHERE company_id = p_company_id
        AND movement_type = 'sale'
        AND machine_toy_slot_id IN (
            SELECT id FROM machine_toy_slots WHERE toy_id = v_product.id
        );
        
        -- Calculate refilled from movements
        SELECT COALESCE(SUM(quantity), 0) INTO v_refilled
        FROM machine_toy_movements
        WHERE company_id = p_company_id
        AND movement_type = 'refill'
        AND machine_toy_slot_id IN (
            SELECT id FROM machine_toy_slots WHERE toy_id = v_product.id
        );
        
        -- Calculate removed from movements
        SELECT COALESCE(SUM(ABS(quantity)), 0) INTO v_removed
        FROM machine_toy_movements
        WHERE company_id = p_company_id
        AND movement_type = 'removal'
        AND machine_toy_slot_id IN (
            SELECT id FROM machine_toy_slots WHERE toy_id = v_product.id
        );
        
        -- Calculate surplus from movements
        SELECT COALESCE(SUM(quantity), 0) INTO v_surplus
        FROM machine_toy_movements
        WHERE company_id = p_company_id
        AND movement_type = 'surplus'
        AND machine_toy_slot_id IN (
            SELECT id FROM machine_toy_slots WHERE toy_id = v_product.id
        );
        
        -- Calculate shortage from movements
        SELECT COALESCE(SUM(ABS(quantity)), 0) INTO v_shortage
        FROM machine_toy_movements
        WHERE company_id = p_company_id
        AND movement_type = 'shortage'
        AND machine_toy_slot_id IN (
            SELECT id FROM machine_toy_slots WHERE toy_id = v_product.id
        );
        
        -- Calculate current in machines from slots
        SELECT COALESCE(SUM(current_stock), 0) INTO v_in_machines
        FROM machine_toy_slots
        WHERE company_id = p_company_id
        AND toy_id = v_product.id;
        
        -- Update product with calculated values
        UPDATE products
        SET 
            quantity_sold = v_sold,
            quantity_in_machines = v_in_machines,
            quantity_bodega = v_product.quantity_purchased - v_in_machines - v_sold,
            quantity_surplus_shortage = v_surplus - v_shortage,
            total_sales_amount = v_sold * cogs, -- Using cogs as price approximation
            updated_at = now()
        WHERE id = v_product.id;
    END LOOP;
END;
$$;

-- Update rollback function to also revert product stats
CREATE OR REPLACE FUNCTION public.rollback_visit_report(p_log_id uuid, p_rollback_notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_log_record submit_report_log_book%ROWTYPE;
    v_visit_report visit_reports%ROWTYPE;
    v_slot_update jsonb;
    v_spot_update jsonb;
    v_location_update jsonb;
    v_slot_item jsonb;
    v_product_id uuid;
    v_units_sold integer;
    v_units_refilled integer;
    v_units_removed integer;
    v_discrepancy integer;
    v_price_per_unit numeric;
BEGIN
    -- Get the log record
    SELECT * INTO v_log_record FROM submit_report_log_book WHERE id = p_log_id;
    
    IF v_log_record IS NULL THEN
        RAISE EXCEPTION 'Log record not found';
    END IF;
    
    IF v_log_record.is_rolled_back THEN
        RAISE EXCEPTION 'This submission has already been rolled back';
    END IF;
    
    -- Get the visit report to access slot_performance_snapshot for product stats reversal
    SELECT * INTO v_visit_report FROM visit_reports WHERE id = v_log_record.visit_report_id;
    
    -- Revert product stats from slot_performance_snapshot
    IF v_visit_report.slot_performance_snapshot IS NOT NULL THEN
        FOR v_slot_item IN SELECT * FROM jsonb_array_elements(v_visit_report.slot_performance_snapshot)
        LOOP
            v_product_id := COALESCE(
                (v_slot_item->>'product_id')::uuid,
                (v_slot_item->>'toy_id')::uuid
            );
            
            IF v_product_id IS NOT NULL THEN
                v_units_sold := COALESCE((v_slot_item->>'units_sold')::int, 0);
                v_units_refilled := COALESCE((v_slot_item->>'units_refilled')::int, 0);
                v_units_removed := COALESCE((v_slot_item->>'units_removed')::int, 0);
                v_discrepancy := COALESCE((v_slot_item->>'discrepancy')::int, (v_slot_item->>'units_shortage_surplus')::int, 0);
                v_price_per_unit := COALESCE((v_slot_item->>'price_per_unit')::numeric, (v_slot_item->>'unit_price_snapshot')::numeric, 1.00);
                
                -- Reverse the product stats update
                UPDATE products
                SET 
                    quantity_sold = quantity_sold - v_units_sold,
                    quantity_in_machines = quantity_in_machines - v_units_refilled + v_units_sold + v_units_removed,
                    quantity_bodega = quantity_bodega + v_units_refilled - v_units_removed,
                    quantity_surplus_shortage = quantity_surplus_shortage - v_discrepancy,
                    total_sales_amount = total_sales_amount - (v_units_sold * v_price_per_unit),
                    updated_at = now()
                WHERE id = v_product_id;
            END IF;
        END LOOP;
    END IF;
    
    -- 1. Delete created machine_toy_movements
    IF array_length(v_log_record.created_machine_toy_movement_ids, 1) > 0 THEN
        DELETE FROM machine_toy_movements 
        WHERE id = ANY(v_log_record.created_machine_toy_movement_ids);
    END IF;
    
    -- 2. Delete created work_orders
    IF array_length(v_log_record.created_work_order_ids, 1) > 0 THEN
        DELETE FROM work_orders 
        WHERE id = ANY(v_log_record.created_work_order_ids);
    END IF;
    
    -- 3. Delete created visit_report_stock records
    IF array_length(v_log_record.created_visit_report_stock_ids, 1) > 0 THEN
        DELETE FROM visit_report_stock 
        WHERE id = ANY(v_log_record.created_visit_report_stock_ids);
    END IF;
    
    -- 4. Restore machine_toy_slots to previous values
    FOR v_slot_update IN SELECT * FROM jsonb_array_elements(v_log_record.updated_machine_toy_slots)
    LOOP
        UPDATE machine_toy_slots
        SET 
            current_stock = COALESCE((v_slot_update->'previous_values'->>'current_stock')::int, current_stock),
            toy_id = CASE 
                WHEN v_slot_update->'previous_values'->>'toy_id' IS NOT NULL 
                THEN (v_slot_update->'previous_values'->>'toy_id')::uuid 
                ELSE toy_id 
            END,
            capacity = COALESCE((v_slot_update->'previous_values'->>'capacity')::int, capacity),
            price_per_unit = COALESCE((v_slot_update->'previous_values'->>'price_per_unit')::numeric, price_per_unit),
            last_refill_date = CASE 
                WHEN v_slot_update->'previous_values'->>'last_refill_date' IS NOT NULL 
                THEN (v_slot_update->'previous_values'->>'last_refill_date')::timestamp with time zone 
                ELSE last_refill_date 
            END
        WHERE id = (v_slot_update->>'id')::uuid;
    END LOOP;
    
    -- 5. Restore location_spots to previous values
    FOR v_spot_update IN SELECT * FROM jsonb_array_elements(v_log_record.updated_location_spots)
    LOOP
        UPDATE location_spots
        SET 
            spot_last_visit_report = CASE 
                WHEN v_spot_update->'previous_values'->>'spot_last_visit_report' IS NOT NULL 
                THEN (v_spot_update->'previous_values'->>'spot_last_visit_report')::timestamp with time zone 
                ELSE NULL 
            END,
            spot_last_visit_report_id = CASE 
                WHEN v_spot_update->'previous_values'->>'spot_last_visit_report_id' IS NOT NULL 
                THEN (v_spot_update->'previous_values'->>'spot_last_visit_report_id')::uuid 
                ELSE NULL 
            END,
            spot_total_sales = COALESCE((v_spot_update->'previous_values'->>'spot_total_sales')::numeric, 0)
        WHERE id = (v_spot_update->>'id')::uuid;
    END LOOP;
    
    -- 6. Restore locations to previous values
    FOR v_location_update IN SELECT * FROM jsonb_array_elements(v_log_record.updated_locations)
    LOOP
        UPDATE locations
        SET 
            location_last_visit_report = CASE 
                WHEN v_location_update->'previous_values'->>'location_last_visit_report' IS NOT NULL 
                THEN (v_location_update->'previous_values'->>'location_last_visit_report')::timestamp with time zone 
                ELSE NULL 
            END,
            location_last_visit_report_id = CASE 
                WHEN v_location_update->'previous_values'->>'location_last_visit_report_id' IS NOT NULL 
                THEN (v_location_update->'previous_values'->>'location_last_visit_report_id')::uuid 
                ELSE NULL 
            END,
            location_total_sales = COALESCE((v_location_update->'previous_values'->>'location_total_sales')::numeric, 0)
        WHERE id = (v_location_update->>'id')::uuid;
    END LOOP;
    
    -- 7. Delete the visit report itself
    IF v_log_record.created_visit_report_id IS NOT NULL THEN
        DELETE FROM visit_reports WHERE id = v_log_record.created_visit_report_id;
    END IF;
    
    -- 8. Mark the log as rolled back
    UPDATE submit_report_log_book
    SET 
        is_rolled_back = true,
        rolled_back_at = now(),
        rolled_back_by = auth.uid(),
        rollback_notes = p_rollback_notes
    WHERE id = p_log_id;
    
    RETURN true;
END;
$$;
