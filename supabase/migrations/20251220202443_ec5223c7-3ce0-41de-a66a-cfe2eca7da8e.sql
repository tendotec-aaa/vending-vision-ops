-- Update the process_visit_report_inventory function to use new column names
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
        
        v_machine_toy_slot_id := CASE WHEN (slot_item->>'slot_id') IS NOT NULL 
                                      THEN (slot_item->>'slot_id')::uuid ELSE NULL END;
        v_product_name := slot_item->>'product_name';
        v_units_sold := COALESCE((slot_item->>'units_sold')::int, 0);
        v_units_refilled := COALESCE((slot_item->>'units_refilled')::int, 0);
        v_units_removed := COALESCE((slot_item->>'units_removed')::int, 0);
        v_discrepancy := COALESCE((slot_item->>'discrepancy')::int, 0);
        v_jam_type := slot_item->>'jam_type';
        v_price_per_unit := COALESCE((slot_item->>'price_per_unit')::numeric, 1.00);

        -- Update machine_toy_slots with new stock using correct column names
        IF v_machine_toy_slot_id IS NOT NULL THEN
            UPDATE public.machine_toy_slots
            SET current_stock = COALESCE((slot_item->>'current_stock')::int, 0),
                toy_id = CASE WHEN (slot_item->>'toy_id') IS NOT NULL 
                         THEN (slot_item->>'toy_id')::uuid 
                         ELSE toy_id END,
                capacity = COALESCE((slot_item->>'capacity')::int, capacity),
                price_per_unit = COALESCE((slot_item->>'price_per_unit')::numeric, price_per_unit),
                last_refill_date = CASE WHEN v_units_refilled > 0 THEN NEW.visit_date ELSE last_refill_date END
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
        IF v_jam_type IS NOT NULL AND v_jam_type != '' THEN
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