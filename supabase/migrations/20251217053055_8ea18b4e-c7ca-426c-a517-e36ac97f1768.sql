-- Update the trigger to calculate and update total_sales_amount for products
CREATE OR REPLACE FUNCTION public.process_visit_report_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    slot_item JSONB;
    movement_qty INTEGER;
    v_company_id UUID;
    v_product_name TEXT;
    v_total_units_sold INTEGER := 0;
    v_price_per_unit NUMERIC := 0;
BEGIN
    -- Skip if no slot_performance_snapshot
    IF NEW.slot_performance_snapshot IS NULL THEN
        RETURN NEW;
    END IF;

    v_company_id := NEW.company_id;

    -- First pass: Calculate total units sold to determine price per unit
    FOR slot_item IN SELECT * FROM jsonb_array_elements(NEW.slot_performance_snapshot)
    LOOP
        v_total_units_sold := v_total_units_sold + COALESCE((slot_item->>'units_sold')::int, 0);
    END LOOP;

    -- Calculate price per unit from total cash removed
    IF v_total_units_sold > 0 AND COALESCE(NEW.total_cash_removed, 0) > 0 THEN
        v_price_per_unit := NEW.total_cash_removed / v_total_units_sold;
    END IF;

    -- Second pass: Process each slot
    FOR slot_item IN SELECT * FROM jsonb_array_elements(NEW.slot_performance_snapshot)
    LOOP
        -- Get product_name from the slot item
        v_product_name := slot_item->>'product_name';

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

        -- B. Update Global Products Table (including sales amount)
        IF (slot_item->>'product_id') IS NOT NULL THEN
            UPDATE public.products
            SET 
                quantity_bodega = quantity_bodega - COALESCE((slot_item->>'units_refilled')::int, 0),
                quantity_in_machines = quantity_in_machines 
                    - COALESCE((slot_item->>'units_sold')::int, 0) 
                    + COALESCE((slot_item->>'units_refilled')::int, 0)
                    - COALESCE((slot_item->>'units_removed')::int, 0),
                quantity_sold = quantity_sold + COALESCE((slot_item->>'units_sold')::int, 0),
                -- Calculate sales amount: units_sold × price_per_unit
                total_sales_amount = total_sales_amount + (COALESCE((slot_item->>'units_sold')::int, 0) * v_price_per_unit)
            WHERE id = (slot_item->>'product_id')::uuid;
        END IF;

        -- C. Insert into Toy Movements Ledger with product_name
        -- Sales
        movement_qty := COALESCE((slot_item->>'units_sold')::int, 0);
        IF movement_qty > 0 AND (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (visit_report_id, product_id, product_name, movement_type, quantity, company_id, spot_id, machine_id, slot_number)
            VALUES (NEW.id, (slot_item->>'product_id')::uuid, v_product_name, 'sale', movement_qty, v_company_id, NEW.spot_id, 
                    CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                    (slot_item->>'slot_number')::int);
        END IF;

        -- Refills
        movement_qty := COALESCE((slot_item->>'units_refilled')::int, 0);
        IF movement_qty > 0 AND (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (visit_report_id, product_id, product_name, movement_type, quantity, company_id, spot_id, machine_id, slot_number)
            VALUES (NEW.id, (slot_item->>'product_id')::uuid, v_product_name, 'refill', movement_qty, v_company_id, NEW.spot_id,
                    CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                    (slot_item->>'slot_number')::int);
        END IF;

        -- Removals
        movement_qty := COALESCE((slot_item->>'units_removed')::int, 0);
        IF movement_qty > 0 AND (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (visit_report_id, product_id, product_name, movement_type, quantity, company_id, spot_id, machine_id, slot_number)
            VALUES (NEW.id, (slot_item->>'product_id')::uuid, v_product_name, 'removal', movement_qty, v_company_id, NEW.spot_id,
                    CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                    (slot_item->>'slot_number')::int);
        END IF;

        -- Audit Adjustments (discrepancy)
        movement_qty := COALESCE((slot_item->>'discrepancy')::int, 0);
        IF movement_qty != 0 AND (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (visit_report_id, product_id, product_name, movement_type, quantity, company_id, spot_id, machine_id, slot_number, notes)
            VALUES (NEW.id, (slot_item->>'product_id')::uuid, v_product_name, 'audit_adjustment', movement_qty, v_company_id, NEW.spot_id,
                    CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                    (slot_item->>'slot_number')::int,
                    'Discrepancy detected during audit');
        END IF;

        -- Replacements
        IF (slot_item->>'is_replacing_toy')::boolean = true AND (slot_item->>'replacement_product_id') IS NOT NULL THEN
            movement_qty := COALESCE((slot_item->>'removed_for_replacement')::int, 0);
            IF movement_qty > 0 THEN
                INSERT INTO public.toy_movements (visit_report_id, product_id, product_name, movement_type, quantity, company_id, spot_id, machine_id, slot_number, notes)
                VALUES (NEW.id, (slot_item->>'replacement_product_id')::uuid, v_product_name, 'replacement', movement_qty, v_company_id, NEW.spot_id,
                        CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                        (slot_item->>'slot_number')::int,
                        'Replaced product ' || COALESCE(slot_item->>'product_id', 'unknown'));
            END IF;
        END IF;
    END LOOP;

    -- --- UPDATE SPOT STATS ---
    UPDATE public.location_spots
    SET 
        spot_last_visit_report = NEW.time_in,
        spot_last_visit_report_id = NEW.id,
        spot_total_sales = COALESCE(spot_total_sales, 0) + COALESCE(NEW.total_cash_removed, 0)
    WHERE id = NEW.spot_id;

    -- --- UPDATE LOCATION STATS ---
    UPDATE public.locations
    SET 
        location_last_visit_report = NEW.time_in,
        location_last_visit_report_id = NEW.id,
        location_total_sales = COALESCE(location_total_sales, 0) + COALESCE(NEW.total_cash_removed, 0)
    WHERE id = NEW.location_id;

    RETURN NEW;
END;
$function$;