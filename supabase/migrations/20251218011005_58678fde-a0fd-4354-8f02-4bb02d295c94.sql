-- First, add new columns to toy_movements for better readability and context
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS visit_report_date timestamp with time zone;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS spot_name text;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS location_id uuid;

-- Add columns for consolidated movement data (one row per slot per visit)
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS sale_amount integer DEFAULT 0;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS refill_amount integer DEFAULT 0;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS removal_amount integer DEFAULT 0;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS jam_amount integer DEFAULT 0;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS jam_type text;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS audited_amount integer;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS surplus_shortage_amount integer DEFAULT 0;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS is_replaced boolean DEFAULT false;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS replacement_product_id uuid;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS current_stock integer;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS last_stock integer;
ALTER TABLE public.toy_movements ADD COLUMN IF NOT EXISTS toy_capacity integer;

-- Reorder columns by dropping and recreating is not feasible, but we can update the trigger to populate properly

-- Update the trigger function to use consolidated approach and populate new fields
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
    v_price_per_unit NUMERIC := 1.00; -- Fixed $1 per unit
    v_company_name TEXT;
    v_location_name TEXT;
    v_spot_name TEXT;
    v_spot_number INTEGER;
    v_daily_rent_rate NUMERIC;
    v_location_rent NUMERIC;
    v_spot_count INTEGER;
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

    -- First pass: Calculate total units sold
    FOR slot_item IN SELECT * FROM jsonb_array_elements(NEW.slot_performance_snapshot)
    LOOP
        v_total_units_sold := v_total_units_sold + COALESCE((slot_item->>'units_sold')::int, 0);
        -- Add jam_type jammed_with_coins as +1 to refill count
        IF (slot_item->>'jam_type') = 'jammed_with_coins' THEN
            v_total_units_sold := v_total_units_sold; -- jam doesn't affect sales calculation
        END IF;
    END LOOP;

    -- Calculate spot rent cost: ((monthly_rent * 12) / 365) * days_active
    SELECT rent_amount INTO v_location_rent FROM public.locations WHERE id = NEW.location_id;
    SELECT COUNT(*) INTO v_spot_count FROM public.location_spots WHERE location_id = NEW.location_id;
    
    IF v_location_rent IS NOT NULL AND v_spot_count > 0 THEN
        v_daily_rent_rate := (v_location_rent / v_spot_count * 12) / 365;
    ELSE
        v_daily_rent_rate := 0;
    END IF;

    -- Second pass: Process each slot - ONE ROW per slot with all movement data consolidated
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

        -- B. Update Global Products Table (including sales amount at $1 per unit)
        IF (slot_item->>'product_id') IS NOT NULL THEN
            UPDATE public.products
            SET 
                quantity_bodega = quantity_bodega - COALESCE((slot_item->>'units_refilled')::int, 0),
                quantity_in_machines = quantity_in_machines 
                    - COALESCE((slot_item->>'units_sold')::int, 0) 
                    + COALESCE((slot_item->>'units_refilled')::int, 0)
                    - COALESCE((slot_item->>'units_removed')::int, 0),
                quantity_sold = quantity_sold + COALESCE((slot_item->>'units_sold')::int, 0),
                -- Calculate sales amount: units_sold × $1.00 per unit (fixed)
                total_sales_amount = total_sales_amount + COALESCE((slot_item->>'units_sold')::int, 0)
            WHERE id = (slot_item->>'product_id')::uuid;
        END IF;

        -- C. Insert ONE consolidated row per slot into Toy Movements Ledger
        IF (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (
                visit_report_id,
                visit_report_date,
                company_id,
                company_name,
                location_id,
                location_name,
                spot_id,
                spot_name,
                user_id,
                machine_id,
                slot_number,
                product_id,
                product_name,
                movement_type,
                quantity,
                sale_amount,
                refill_amount,
                removal_amount,
                jam_type,
                jam_amount,
                audited_amount,
                surplus_shortage_amount,
                is_replaced,
                replacement_product_id,
                current_stock,
                last_stock,
                toy_capacity,
                notes
            )
            VALUES (
                NEW.id,
                NEW.time_in,
                v_company_id,
                v_company_name,
                NEW.location_id,
                v_location_name,
                NEW.spot_id,
                v_spot_name,
                NEW.employee_id,
                CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                (slot_item->>'slot_number')::int,
                (slot_item->>'product_id')::uuid,
                v_product_name,
                'slot_audit', -- Consolidated movement type
                COALESCE((slot_item->>'units_sold')::int, 0) + COALESCE((slot_item->>'units_refilled')::int, 0), -- Total activity
                COALESCE((slot_item->>'units_sold')::int, 0),
                COALESCE((slot_item->>'units_refilled')::int, 0) + 
                    CASE WHEN (slot_item->>'jam_type') = 'jammed_with_coins' THEN 1 ELSE 0 END, -- +1 refill for jammed_with_coins
                COALESCE((slot_item->>'units_removed')::int, 0),
                slot_item->>'jam_type',
                CASE WHEN (slot_item->>'jam_type') IS NOT NULL AND (slot_item->>'jam_type') != '' THEN 1 ELSE 0 END,
                (slot_item->>'audited_count')::int,
                COALESCE((slot_item->>'discrepancy')::int, 0),
                COALESCE((slot_item->>'is_replacing_toy')::boolean, false),
                CASE WHEN (slot_item->>'replacement_product_id') IS NOT NULL THEN (slot_item->>'replacement_product_id')::uuid ELSE NULL END,
                COALESCE((slot_item->>'current_stock')::int, 0),
                COALESCE((slot_item->>'last_stock')::int, 0),
                COALESCE((slot_item->>'toy_capacity')::int, 0),
                CASE WHEN COALESCE((slot_item->>'discrepancy')::int, 0) != 0 THEN 'Discrepancy detected during audit' ELSE NULL END
            );
        END IF;
    END LOOP;

    -- --- UPDATE SPOT STATS with correct rent formula ---
    -- Rent calculation: ((monthly_rent * 12) / 365) * days_active
    DECLARE
        v_previous_visit TIMESTAMP WITH TIME ZONE;
        v_days_active NUMERIC;
        v_calculated_rent NUMERIC;
        v_spot_rent NUMERIC;
    BEGIN
        -- Get previous visit date
        SELECT spot_last_visit_report INTO v_previous_visit FROM public.location_spots WHERE id = NEW.spot_id;
        
        -- Calculate days since last visit (or from start date if first visit)
        IF v_previous_visit IS NOT NULL THEN
            v_days_active := EXTRACT(EPOCH FROM (NEW.time_in - v_previous_visit)) / 86400;
        ELSE
            -- Get location start date for first visit
            SELECT start_date INTO v_previous_visit FROM public.locations WHERE id = NEW.location_id;
            IF v_previous_visit IS NOT NULL THEN
                v_days_active := EXTRACT(EPOCH FROM (NEW.time_in - v_previous_visit)) / 86400;
            ELSE
                v_days_active := 0;
            END IF;
        END IF;
        
        -- Calculate rent for this spot: ((monthly_rent / spot_count * 12) / 365) * days_active
        v_calculated_rent := v_daily_rent_rate * GREATEST(v_days_active, 0);
        
        -- Update visit report with calculated rent
        NEW.rent_calculated := v_calculated_rent;
        
        -- Update spot stats
        UPDATE public.location_spots
        SET 
            spot_last_visit_report = NEW.time_in,
            spot_last_visit_report_id = NEW.id,
            spot_total_sales = COALESCE(spot_total_sales, 0) + (v_total_units_sold * v_price_per_unit),
            spot_total_rent = COALESCE(spot_total_rent, 0) + v_calculated_rent
        WHERE id = NEW.spot_id;

        -- Update location stats
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

-- Drop the old BEFORE INSERT trigger and create updated one
DROP TRIGGER IF EXISTS handle_visit_report_submission ON public.visit_reports;
DROP TRIGGER IF EXISTS process_visit_report_inventory_trigger ON public.visit_reports;

CREATE TRIGGER process_visit_report_inventory_trigger
    BEFORE INSERT ON public.visit_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.process_visit_report_inventory();