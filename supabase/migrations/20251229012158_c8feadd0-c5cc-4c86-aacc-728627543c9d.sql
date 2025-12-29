-- Fix rollback_visit_report function to add company authorization and admin role checks
CREATE OR REPLACE FUNCTION public.rollback_visit_report(p_log_id uuid, p_rollback_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    
    -- SECURITY CHECK: Verify caller is from same company
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND company_id = v_log_record.company_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: user not in same company';
    END IF;
    
    -- SECURITY CHECK: Only admins can rollback reports
    IF NOT has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Only admins can rollback reports';
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
$function$;