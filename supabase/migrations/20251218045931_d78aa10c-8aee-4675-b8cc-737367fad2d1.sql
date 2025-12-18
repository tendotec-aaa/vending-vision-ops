-- Add replacement_product_name column to toy_movements
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS replacement_product_name text;

-- Drop and recreate the trigger function with corrected logic
CREATE OR REPLACE FUNCTION public.process_visit_report_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    slot_item JSONB;
    v_company_id UUID;
    v_product_name TEXT;
    v_original_product_name TEXT;
    v_replacement_product_name TEXT;
    v_total_units_sold INTEGER := 0;
    v_price_per_unit NUMERIC := 1.00;
    v_company_name TEXT;
    v_location_name TEXT;
    v_spot_name TEXT;
    v_spot_number INTEGER;
    v_daily_rent_rate NUMERIC;
    v_location_rent NUMERIC;
    v_spot_count INTEGER;
    v_is_replacing BOOLEAN;
    v_original_product_id UUID;
    v_replacement_product_id UUID;
    v_removed_count INTEGER;
    v_units_sold INTEGER;
    v_units_refilled INTEGER;
    v_last_stock INTEGER;
    v_surplus_shortage INTEGER;
    v_slot_capacity INTEGER;
    v_new_toy_refill INTEGER;
    v_new_toy_capacity INTEGER;
BEGIN
    -- Skip if no slot_performance_snapshot
    IF NEW.slot_performance_snapshot IS NULL THEN
        RETURN NEW;
    END IF;

    v_company_id := NEW.company_id;

    -- Get company name
    SELECT name INTO v_company_name FROM public.companies WHERE id = v_company_id;
    
    -- Get location name
    SELECT name INTO v_location_name FROM public.locations WHERE id = NEW.location_id;
    
    -- Get spot info
    SELECT spot_number, place_name INTO v_spot_number, v_spot_name 
    FROM public.location_spots WHERE id = NEW.spot_id;
    v_spot_name := COALESCE(v_spot_name, v_location_name || ' #' || v_spot_number);

    -- First pass: Calculate total units sold (for cash recollected)
    FOR slot_item IN SELECT * FROM jsonb_array_elements(NEW.slot_performance_snapshot)
    LOOP
        v_total_units_sold := v_total_units_sold + COALESCE((slot_item->>'units_sold')::int, 0);
    END LOOP;

    -- Calculate spot rent cost: ((monthly_rent * 12) / 365) * days_active
    SELECT rent_amount INTO v_location_rent FROM public.locations WHERE id = NEW.location_id;
    SELECT COUNT(*) INTO v_spot_count FROM public.location_spots WHERE location_id = NEW.location_id;
    
    IF v_location_rent IS NOT NULL AND v_spot_count > 0 THEN
        v_daily_rent_rate := (v_location_rent / v_spot_count * 12) / 365;
    ELSE
        v_daily_rent_rate := 0;
    END IF;

    -- Second pass: Process each slot
    FOR slot_item IN SELECT * FROM jsonb_array_elements(NEW.slot_performance_snapshot)
    LOOP
        v_is_replacing := COALESCE((slot_item->>'is_replacing_toy')::boolean, false);
        v_original_product_id := CASE WHEN (slot_item->>'original_product_id') IS NOT NULL 
                                      THEN (slot_item->>'original_product_id')::uuid ELSE NULL END;
        v_replacement_product_id := CASE WHEN (slot_item->>'replacement_product_id') IS NOT NULL 
                                         THEN (slot_item->>'replacement_product_id')::uuid ELSE NULL END;
        
        -- Get product names
        v_product_name := slot_item->>'product_name';
        v_original_product_name := slot_item->>'original_product_name';
        
        -- Get replacement product name from products table
        IF v_replacement_product_id IS NOT NULL THEN
            SELECT product_name INTO v_replacement_product_name FROM public.products WHERE id = v_replacement_product_id;
        ELSE
            v_replacement_product_name := NULL;
        END IF;

        -- A. Update Machine Toy Slots (Current Stock Sync)
        IF (slot_item->>'slot_id') IS NOT NULL THEN
            UPDATE public.machine_toy_slots
            SET toy_current_stock = COALESCE((slot_item->>'current_stock')::int, 0),
                product_id = CASE WHEN (slot_item->>'product_id') IS NOT NULL 
                             THEN (slot_item->>'product_id')::uuid 
                             ELSE product_id END,
                toy_capacity = COALESCE((slot_item->>'toy_capacity')::int, toy_capacity)
            WHERE id = (slot_item->>'slot_id')::uuid;
        END IF;

        -- B. Handle toy replacement - TWO separate records
        IF v_is_replacing AND v_original_product_id IS NOT NULL AND v_replacement_product_id IS NOT NULL THEN
            -- Get values for the removed toy
            v_units_sold := COALESCE((slot_item->>'units_sold')::int, 0);
            v_last_stock := COALESCE((slot_item->>'last_stock')::int, 0);
            v_removed_count := COALESCE((slot_item->>'removed_for_replacement')::int, 0);
            v_slot_capacity := COALESCE((slot_item->>'toy_capacity')::int, 0);
            
            -- Calculate surplus/shortage for removed toy: last_stock - units_sold - removed_count should = 0
            -- If removed_count != (last_stock - units_sold), there's a discrepancy
            v_surplus_shortage := v_removed_count - (v_last_stock - v_units_sold);
            
            -- New toy values (units_refilled is for the new toy)
            v_new_toy_refill := COALESCE((slot_item->>'units_refilled')::int, 0);
            v_new_toy_capacity := v_slot_capacity;

            -- Update ORIGINAL product (being removed) - reduce inventory
            UPDATE public.products
            SET 
                quantity_in_machines = quantity_in_machines - v_last_stock,
                quantity_sold = quantity_sold + v_units_sold,
                total_sales_amount = total_sales_amount + v_units_sold,
                quantity_surplus_shortage = quantity_surplus_shortage + v_surplus_shortage
            WHERE id = v_original_product_id;

            -- Update REPLACEMENT product - add to machines, reduce bodega
            UPDATE public.products
            SET 
                quantity_bodega = quantity_bodega - v_new_toy_refill,
                quantity_in_machines = quantity_in_machines + v_new_toy_refill
            WHERE id = v_replacement_product_id;

            -- ROW 1: Insert record for REMOVED toy (original product)
            INSERT INTO public.toy_movements (
                visit_report_id, visit_report_date, company_id, company_name,
                location_id, location_name, spot_id, spot_name, user_id,
                machine_id, slot_number, product_id, product_name,
                movement_type, quantity, sale_amount, refill_amount, removal_amount,
                jam_type, jam_amount, audited_amount, surplus_shortage_amount,
                is_replaced, replacement_product_id, replacement_product_name,
                current_stock, last_stock, toy_capacity, notes
            )
            VALUES (
                NEW.id, NEW.time_in, v_company_id, v_company_name,
                NEW.location_id, v_location_name, NEW.spot_id, v_spot_name, NEW.employee_id,
                CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                (slot_item->>'slot_number')::int,
                v_original_product_id,
                v_original_product_name,
                'slot_audit',
                v_units_sold + v_removed_count,
                v_units_sold,
                0, -- No refills for removed toy
                v_removed_count,
                slot_item->>'jam_type',
                CASE WHEN (slot_item->>'jam_type') = 'jammed_with_coins' THEN 1 ELSE 0 END,
                NULL, -- No audit for removed toy
                v_surplus_shortage,
                true,
                v_replacement_product_id,
                v_replacement_product_name,
                0, -- Current stock is 0 after removal
                v_last_stock,
                v_slot_capacity,
                'Toy replaced with ' || COALESCE(v_replacement_product_name, 'new product')
            );

            -- ROW 2: Insert record for NEW toy (replacement product)
            INSERT INTO public.toy_movements (
                visit_report_id, visit_report_date, company_id, company_name,
                location_id, location_name, spot_id, spot_name, user_id,
                machine_id, slot_number, product_id, product_name,
                movement_type, quantity, sale_amount, refill_amount, removal_amount,
                jam_type, jam_amount, audited_amount, surplus_shortage_amount,
                is_replaced, replacement_product_id, replacement_product_name,
                current_stock, last_stock, toy_capacity, notes
            )
            VALUES (
                NEW.id, NEW.time_in, v_company_id, v_company_name,
                NEW.location_id, v_location_name, NEW.spot_id, v_spot_name, NEW.employee_id,
                CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                (slot_item->>'slot_number')::int,
                v_replacement_product_id,
                v_replacement_product_name,
                'slot_audit',
                v_new_toy_refill,
                0, -- No sales yet for new toy
                v_new_toy_refill,
                0, -- No removals
                NULL, -- No jam
                0,
                NULL,
                0, -- No surplus/shortage
                false,
                NULL,
                NULL,
                v_new_toy_refill, -- Current stock = refilled amount
                0, -- Last stock = 0 (new toy)
                v_new_toy_capacity,
                'New toy installed (replaced ' || COALESCE(v_original_product_name, 'previous product') || ')'
            );

        -- C. Normal slot processing (no replacement)
        ELSIF (slot_item->>'product_id') IS NOT NULL THEN
            v_units_sold := COALESCE((slot_item->>'units_sold')::int, 0);
            v_units_refilled := COALESCE((slot_item->>'units_refilled')::int, 0);
            
            -- Add +1 to refill for jammed_with_coins
            IF (slot_item->>'jam_type') = 'jammed_with_coins' THEN
                v_units_refilled := v_units_refilled + 1;
            END IF;

            -- Update Global Products Table
            UPDATE public.products
            SET 
                quantity_bodega = quantity_bodega - COALESCE((slot_item->>'units_refilled')::int, 0),
                quantity_in_machines = quantity_in_machines 
                    - v_units_sold 
                    + COALESCE((slot_item->>'units_refilled')::int, 0)
                    - COALESCE((slot_item->>'units_removed')::int, 0),
                quantity_sold = quantity_sold + v_units_sold,
                total_sales_amount = total_sales_amount + v_units_sold,
                quantity_surplus_shortage = quantity_surplus_shortage + COALESCE((slot_item->>'discrepancy')::int, 0)
            WHERE id = (slot_item->>'product_id')::uuid;

            -- Insert ONE consolidated row for this slot
            INSERT INTO public.toy_movements (
                visit_report_id, visit_report_date, company_id, company_name,
                location_id, location_name, spot_id, spot_name, user_id,
                machine_id, slot_number, product_id, product_name,
                movement_type, quantity, sale_amount, refill_amount, removal_amount,
                jam_type, jam_amount, audited_amount, surplus_shortage_amount,
                is_replaced, replacement_product_id, replacement_product_name,
                current_stock, last_stock, toy_capacity, notes
            )
            VALUES (
                NEW.id, NEW.time_in, v_company_id, v_company_name,
                NEW.location_id, v_location_name, NEW.spot_id, v_spot_name, NEW.employee_id,
                CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                (slot_item->>'slot_number')::int,
                (slot_item->>'product_id')::uuid,
                v_product_name,
                'slot_audit',
                v_units_sold + v_units_refilled,
                v_units_sold,
                v_units_refilled,
                COALESCE((slot_item->>'units_removed')::int, 0),
                slot_item->>'jam_type',
                CASE WHEN (slot_item->>'jam_type') = 'jammed_with_coins' THEN 1 ELSE 0 END,
                (slot_item->>'audited_count')::int,
                COALESCE((slot_item->>'discrepancy')::int, 0),
                false,
                NULL,
                NULL,
                COALESCE((slot_item->>'current_stock')::int, 0),
                COALESCE((slot_item->>'last_stock')::int, 0),
                COALESCE((slot_item->>'toy_capacity')::int, 0),
                CASE WHEN COALESCE((slot_item->>'discrepancy')::int, 0) != 0 THEN 'Discrepancy detected during audit' ELSE NULL END
            );
        END IF;
    END LOOP;

    -- UPDATE SPOT STATS with correct rent formula
    DECLARE
        v_previous_visit TIMESTAMP WITH TIME ZONE;
        v_days_active NUMERIC;
        v_calculated_rent NUMERIC;
    BEGIN
        SELECT spot_last_visit_report INTO v_previous_visit FROM public.location_spots WHERE id = NEW.spot_id;
        
        IF v_previous_visit IS NOT NULL THEN
            v_days_active := EXTRACT(EPOCH FROM (NEW.time_in - v_previous_visit)) / 86400;
        ELSE
            SELECT start_date INTO v_previous_visit FROM public.locations WHERE id = NEW.location_id;
            IF v_previous_visit IS NOT NULL THEN
                v_days_active := EXTRACT(EPOCH FROM (NEW.time_in - v_previous_visit)) / 86400;
            ELSE
                v_days_active := 0;
            END IF;
        END IF;
        
        v_calculated_rent := v_daily_rent_rate * GREATEST(v_days_active, 0);
        NEW.rent_calculated := v_calculated_rent;
        
        UPDATE public.location_spots
        SET 
            spot_last_visit_report = NEW.time_in,
            spot_last_visit_report_id = NEW.id,
            spot_total_sales = COALESCE(spot_total_sales, 0) + (v_total_units_sold * v_price_per_unit),
            spot_total_rent = COALESCE(spot_total_rent, 0) + v_calculated_rent
        WHERE id = NEW.spot_id;

        UPDATE public.locations
        SET 
            location_last_visit_report = NEW.time_in,
            location_last_visit_report_id = NEW.id,
            location_total_sales = COALESCE(location_total_sales, 0) + (v_total_units_sold * v_price_per_unit)
        WHERE id = NEW.location_id;
    END;

    RETURN NEW;
END;
$function$;

-- Ensure the trigger is AFTER INSERT (not BEFORE)
DROP TRIGGER IF EXISTS process_visit_report_inventory_trigger ON public.visit_reports;
DROP TRIGGER IF EXISTS after_visit_report_insert ON public.visit_reports;
CREATE TRIGGER after_visit_report_insert
    AFTER INSERT ON public.visit_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.process_visit_report_inventory();