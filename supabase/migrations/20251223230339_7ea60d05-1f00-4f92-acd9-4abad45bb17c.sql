
-- Add location_name_cached and spot_name_cached to machine_toy_slots for human readability
ALTER TABLE public.machine_toy_slots 
ADD COLUMN IF NOT EXISTS location_name_cached TEXT,
ADD COLUMN IF NOT EXISTS spot_name_cached TEXT;

-- Update the trigger to also populate these new cached name fields
CREATE OR REPLACE FUNCTION public.process_visit_report_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    slot_item JSONB;
    v_company_id UUID;
    v_employee_id UUID;
    v_setup_id UUID;
    v_employee_name TEXT;
    v_location_name TEXT;
    v_spot_name TEXT;
    v_product_name TEXT;
    v_total_units_sold INTEGER := 0;
    v_price_per_unit NUMERIC := 1.00;
    v_slot_capacity INTEGER;
    v_units_sold INTEGER;
    v_units_refilled INTEGER;
    v_units_removed INTEGER;
    v_discrepancy INTEGER;
    v_machine_toy_slot_id UUID;
    v_jam_type TEXT;
    v_toy_id UUID;
    v_current_stock INTEGER;
    v_toy_capacity INTEGER;
    v_machine_serial TEXT;
BEGIN
    IF NEW.slot_performance_snapshot IS NULL THEN
        RETURN NEW;
    END IF;

    v_company_id := NEW.company_id;
    v_employee_id := NEW.employee_id;
    v_setup_id := NEW.setup_id;
    v_employee_name := NEW.employee_name_snapshot;
    v_location_name := NEW.location_name_snapshot;
    v_spot_name := NEW.spot_name_snapshot;

    -- Process each slot
    FOR slot_item IN SELECT * FROM jsonb_array_elements(NEW.slot_performance_snapshot)
    LOOP
        v_total_units_sold := v_total_units_sold + COALESCE((slot_item->>'units_sold')::int, 0);
        
        -- Get machine_toy_slot_id from either 'slot_id' or 'machine_toy_slot_id'
        v_machine_toy_slot_id := CASE 
            WHEN (slot_item->>'slot_id') IS NOT NULL THEN (slot_item->>'slot_id')::uuid 
            WHEN (slot_item->>'machine_toy_slot_id') IS NOT NULL THEN (slot_item->>'machine_toy_slot_id')::uuid
            ELSE NULL 
        END;
        
        v_product_name := COALESCE(slot_item->>'product_name', slot_item->>'toy_name');
        v_machine_serial := slot_item->>'machine_serial_snapshot';
        v_units_sold := COALESCE((slot_item->>'units_sold')::int, 0);
        v_units_refilled := COALESCE((slot_item->>'units_refilled')::int, 0);
        v_units_removed := COALESCE((slot_item->>'units_removed')::int, 0);
        v_discrepancy := COALESCE((slot_item->>'discrepancy')::int, (slot_item->>'units_shortage_surplus')::int, 0);
        v_jam_type := slot_item->>'jam_type';
        v_price_per_unit := COALESCE((slot_item->>'price_per_unit')::numeric, (slot_item->>'unit_price_snapshot')::numeric, 1.00);
        
        -- Get toy_id from 'product_id' (form uses products table) or 'toy_id' for backward compatibility
        -- For replacements, use replacement_product_id
        v_toy_id := CASE 
            WHEN (slot_item->>'is_replacing_toy')::boolean = true OR (slot_item->>'is_being_replaced')::boolean = true THEN
                COALESCE((slot_item->>'replacement_product_id')::uuid, (slot_item->>'replacement_toy_id')::uuid, (slot_item->>'product_id')::uuid)
            ELSE
                COALESCE((slot_item->>'product_id')::uuid, (slot_item->>'toy_id')::uuid)
        END;
        
        -- Get current_stock from snapshot
        v_current_stock := COALESCE((slot_item->>'current_stock')::int, 0);
        
        -- Get capacity from 'toy_capacity' (form field name) or 'capacity'
        v_toy_capacity := COALESCE((slot_item->>'toy_capacity')::int, (slot_item->>'capacity')::int, 15);

        -- Update machine_toy_slots with new stock and all relevant fields including cached names
        IF v_machine_toy_slot_id IS NOT NULL THEN
            UPDATE public.machine_toy_slots
            SET 
                current_stock = v_current_stock,
                toy_id = COALESCE(v_toy_id, toy_id),
                toy_name_cached = COALESCE(v_product_name, toy_name_cached),
                capacity = v_toy_capacity,
                price_per_unit = v_price_per_unit,
                last_refill_date = CASE WHEN v_units_refilled > 0 THEN NEW.visit_date ELSE last_refill_date END,
                location_id = NEW.location_id,
                spot_id = NEW.spot_id,
                location_name_cached = v_location_name,
                spot_name_cached = v_spot_name,
                machine_serial_cached = COALESCE(v_machine_serial, machine_serial_cached),
                employee_id = v_employee_id
            WHERE id = v_machine_toy_slot_id;
        END IF;

        -- Insert SALE movement if units sold > 0
        IF v_units_sold > 0 THEN
            INSERT INTO public.machine_toy_movements (
                visit_report_id, machine_toy_slot_id, company_id, employee_id,
                location_id, spot_id, setup_id,
                employee_name_snapshot, location_name_snapshot, spot_name_snapshot,
                movement_date, movement_type, quantity, toy_name_snapshot, movement_description
            ) VALUES (
                NEW.id, v_machine_toy_slot_id, v_company_id, v_employee_id,
                NEW.location_id, NEW.spot_id, v_setup_id,
                v_employee_name, v_location_name, v_spot_name,
                NEW.visit_date, 'sale', -v_units_sold, v_product_name,
                'Sold ' || v_units_sold || ' units'
            );
        END IF;

        -- Insert REFILL movement if units refilled > 0
        IF v_units_refilled > 0 THEN
            INSERT INTO public.machine_toy_movements (
                visit_report_id, machine_toy_slot_id, company_id, employee_id,
                location_id, spot_id, setup_id,
                employee_name_snapshot, location_name_snapshot, spot_name_snapshot,
                movement_date, movement_type, quantity, toy_name_snapshot, movement_description
            ) VALUES (
                NEW.id, v_machine_toy_slot_id, v_company_id, v_employee_id,
                NEW.location_id, NEW.spot_id, v_setup_id,
                v_employee_name, v_location_name, v_spot_name,
                NEW.visit_date, 'refill', v_units_refilled, v_product_name,
                'Refilled ' || v_units_refilled || ' units'
            );
        END IF;

        -- Insert REMOVAL movement if units removed > 0
        IF v_units_removed > 0 THEN
            INSERT INTO public.machine_toy_movements (
                visit_report_id, machine_toy_slot_id, company_id, employee_id,
                location_id, spot_id, setup_id,
                employee_name_snapshot, location_name_snapshot, spot_name_snapshot,
                movement_date, movement_type, quantity, toy_name_snapshot, movement_description
            ) VALUES (
                NEW.id, v_machine_toy_slot_id, v_company_id, v_employee_id,
                NEW.location_id, NEW.spot_id, v_setup_id,
                v_employee_name, v_location_name, v_spot_name,
                NEW.visit_date, 'removal', -v_units_removed, v_product_name,
                'Removed ' || v_units_removed || ' units'
            );
        END IF;

        -- Insert SURPLUS movement if discrepancy > 0
        IF v_discrepancy > 0 THEN
            INSERT INTO public.machine_toy_movements (
                visit_report_id, machine_toy_slot_id, company_id, employee_id,
                location_id, spot_id, setup_id,
                employee_name_snapshot, location_name_snapshot, spot_name_snapshot,
                movement_date, movement_type, quantity, toy_name_snapshot, movement_description
            ) VALUES (
                NEW.id, v_machine_toy_slot_id, v_company_id, v_employee_id,
                NEW.location_id, NEW.spot_id, v_setup_id,
                v_employee_name, v_location_name, v_spot_name,
                NEW.visit_date, 'surplus', v_discrepancy, v_product_name,
                'Surplus of ' || v_discrepancy || ' units found'
            );
        END IF;

        -- Insert SHORTAGE movement if discrepancy < 0
        IF v_discrepancy < 0 THEN
            INSERT INTO public.machine_toy_movements (
                visit_report_id, machine_toy_slot_id, company_id, employee_id,
                location_id, spot_id, setup_id,
                employee_name_snapshot, location_name_snapshot, spot_name_snapshot,
                movement_date, movement_type, quantity, toy_name_snapshot, movement_description
            ) VALUES (
                NEW.id, v_machine_toy_slot_id, v_company_id, v_employee_id,
                NEW.location_id, NEW.spot_id, v_setup_id,
                v_employee_name, v_location_name, v_spot_name,
                NEW.visit_date, 'shortage', v_discrepancy, v_product_name,
                'Shortage of ' || ABS(v_discrepancy) || ' units'
            );
        END IF;

        -- Insert JAM movement if jam occurred
        IF v_jam_type IS NOT NULL AND v_jam_type != '' AND v_jam_type != 'none' THEN
            INSERT INTO public.machine_toy_movements (
                visit_report_id, machine_toy_slot_id, company_id, employee_id,
                location_id, spot_id, setup_id,
                employee_name_snapshot, location_name_snapshot, spot_name_snapshot,
                movement_date, movement_type, quantity, toy_name_snapshot, movement_description
            ) VALUES (
                NEW.id, v_machine_toy_slot_id, v_company_id, v_employee_id,
                NEW.location_id, NEW.spot_id, v_setup_id,
                v_employee_name, v_location_name, v_spot_name,
                NEW.visit_date, 
                CASE WHEN v_jam_type = 'jammed_with_coins' THEN 'jam with coins +1' ELSE 'jam without coins' END,
                CASE WHEN v_jam_type = 'jammed_with_coins' THEN 1 ELSE 0 END, 
                v_product_name,
                CASE WHEN v_jam_type = 'jammed_with_coins' THEN 'Jammed with coins (+1 sale)' ELSE 'Jammed without coins' END
            );
        END IF;
    END LOOP;

    -- Update spot and location stats
    UPDATE public.location_spots
    SET 
        spot_last_visit_report = NEW.visit_date,
        spot_last_visit_report_id = NEW.id,
        spot_total_sales = COALESCE(spot_total_sales, 0) + COALESCE(NEW.total_cash_collected, 0)
    WHERE id = NEW.spot_id;

    UPDATE public.locations
    SET 
        location_last_visit_report = NEW.visit_date,
        location_last_visit_report_id = NEW.id,
        location_total_sales = COALESCE(location_total_sales, 0) + COALESCE(NEW.total_cash_collected, 0)
    WHERE id = NEW.location_id;

    RETURN NEW;
END;
$function$;
