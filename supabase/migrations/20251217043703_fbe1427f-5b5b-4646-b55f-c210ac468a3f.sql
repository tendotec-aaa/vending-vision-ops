-- Add JSONB snapshot and rent_calculated columns to visit_reports
ALTER TABLE public.visit_reports 
ADD COLUMN IF NOT EXISTS slot_performance_snapshot jsonb,
ADD COLUMN IF NOT EXISTS rent_calculated numeric DEFAULT 0;

-- Create toy_movements ledger table
CREATE TABLE IF NOT EXISTS public.toy_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_report_id uuid NOT NULL REFERENCES public.visit_reports(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  movement_type text NOT NULL CHECK (movement_type IN ('sale', 'refill', 'removal', 'audit_adjustment', 'replacement')),
  quantity integer NOT NULL DEFAULT 0,
  company_id uuid NOT NULL,
  spot_id uuid REFERENCES public.location_spots(id),
  machine_id uuid REFERENCES public.machines(id),
  slot_number integer,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on toy_movements
ALTER TABLE public.toy_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for toy_movements
CREATE POLICY "Users can view movements in their company" 
ON public.toy_movements 
FOR SELECT 
USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create movements in their company" 
ON public.toy_movements 
FOR INSERT 
WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_toy_movements_visit_report ON public.toy_movements(visit_report_id);
CREATE INDEX IF NOT EXISTS idx_toy_movements_product ON public.toy_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_toy_movements_company ON public.toy_movements(company_id);

-- Create the comprehensive trigger function for visit report submission
CREATE OR REPLACE FUNCTION public.handle_visit_report_submission()
RETURNS TRIGGER AS $$
DECLARE
    previous_visit_date TIMESTAMP WITH TIME ZONE;
    days_diff NUMERIC;
    spot_rent_per_spot NUMERIC;
    location_rent NUMERIC;
    location_start DATE;
    slot_item JSONB;
    movement_qty INTEGER;
BEGIN
    -- Skip if no slot_performance_snapshot (backward compatibility)
    IF NEW.slot_performance_snapshot IS NULL THEN
        RETURN NEW;
    END IF;

    -- --- RENT CALCULATION LOGIC ---
    -- Get the previous visit date from the spot
    SELECT spot_last_visit_report INTO previous_visit_date
    FROM public.location_spots 
    WHERE id = NEW.spot_id;

    -- Get rent info from location
    SELECT rent_amount, start_date INTO location_rent, location_start
    FROM public.locations
    WHERE id = NEW.location_id;

    -- Count spots to calculate per-spot rent
    SELECT COUNT(*) INTO days_diff FROM public.location_spots WHERE location_id = NEW.location_id;
    IF days_diff > 0 AND location_rent IS NOT NULL THEN
        spot_rent_per_spot := location_rent / days_diff;
    ELSE
        spot_rent_per_spot := 0;
    END IF;

    -- Calculate rent based on days since last visit (or start date if first visit)
    IF previous_visit_date IS NULL THEN
        -- First visit: calculate from location start date
        IF location_start IS NOT NULL THEN
            days_diff := EXTRACT(EPOCH FROM (NEW.time_in - location_start::timestamp with time zone)) / 86400;
        ELSE
            days_diff := 0;
        END IF;
    ELSE
        days_diff := EXTRACT(EPOCH FROM (NEW.time_in - previous_visit_date)) / 86400;
    END IF;

    -- Set rent_calculated: (Monthly / 30) * Days
    IF days_diff > 0 THEN
        NEW.rent_calculated := (spot_rent_per_spot / 30.0) * days_diff;
    ELSE
        NEW.rent_calculated := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create BEFORE INSERT trigger for rent calculation
DROP TRIGGER IF EXISTS before_visit_report_insert ON public.visit_reports;
CREATE TRIGGER before_visit_report_insert
BEFORE INSERT ON public.visit_reports
FOR EACH ROW
EXECUTE FUNCTION public.handle_visit_report_submission();

-- Create AFTER INSERT function to handle inventory updates and ledger entries
CREATE OR REPLACE FUNCTION public.process_visit_report_inventory()
RETURNS TRIGGER AS $$
DECLARE
    slot_item JSONB;
    movement_qty INTEGER;
    v_company_id UUID;
BEGIN
    -- Skip if no slot_performance_snapshot
    IF NEW.slot_performance_snapshot IS NULL THEN
        RETURN NEW;
    END IF;

    v_company_id := NEW.company_id;

    -- Iterate through the JSON Array
    FOR slot_item IN SELECT * FROM jsonb_array_elements(NEW.slot_performance_snapshot)
    LOOP
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

        -- B. Update Global Products Table
        IF (slot_item->>'product_id') IS NOT NULL THEN
            UPDATE public.products
            SET 
                quantity_bodega = quantity_bodega - COALESCE((slot_item->>'units_refilled')::int, 0),
                quantity_in_machines = quantity_in_machines 
                    - COALESCE((slot_item->>'units_sold')::int, 0) 
                    + COALESCE((slot_item->>'units_refilled')::int, 0)
                    - COALESCE((slot_item->>'units_removed')::int, 0),
                quantity_sold = quantity_sold + COALESCE((slot_item->>'units_sold')::int, 0)
            WHERE id = (slot_item->>'product_id')::uuid;
        END IF;

        -- C. Insert into Toy Movements Ledger
        -- Sales
        movement_qty := COALESCE((slot_item->>'units_sold')::int, 0);
        IF movement_qty > 0 AND (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (visit_report_id, product_id, movement_type, quantity, company_id, spot_id, machine_id, slot_number)
            VALUES (NEW.id, (slot_item->>'product_id')::uuid, 'sale', movement_qty, v_company_id, NEW.spot_id, 
                    CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                    (slot_item->>'slot_number')::int);
        END IF;

        -- Refills
        movement_qty := COALESCE((slot_item->>'units_refilled')::int, 0);
        IF movement_qty > 0 AND (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (visit_report_id, product_id, movement_type, quantity, company_id, spot_id, machine_id, slot_number)
            VALUES (NEW.id, (slot_item->>'product_id')::uuid, 'refill', movement_qty, v_company_id, NEW.spot_id,
                    CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                    (slot_item->>'slot_number')::int);
        END IF;

        -- Removals
        movement_qty := COALESCE((slot_item->>'units_removed')::int, 0);
        IF movement_qty > 0 AND (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (visit_report_id, product_id, movement_type, quantity, company_id, spot_id, machine_id, slot_number)
            VALUES (NEW.id, (slot_item->>'product_id')::uuid, 'removal', movement_qty, v_company_id, NEW.spot_id,
                    CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                    (slot_item->>'slot_number')::int);
        END IF;

        -- Audit Adjustments (discrepancy)
        movement_qty := COALESCE((slot_item->>'discrepancy')::int, 0);
        IF movement_qty != 0 AND (slot_item->>'product_id') IS NOT NULL THEN
            INSERT INTO public.toy_movements (visit_report_id, product_id, movement_type, quantity, company_id, spot_id, machine_id, slot_number, notes)
            VALUES (NEW.id, (slot_item->>'product_id')::uuid, 'audit_adjustment', movement_qty, v_company_id, NEW.spot_id,
                    CASE WHEN (slot_item->>'machine_id') IS NOT NULL THEN (slot_item->>'machine_id')::uuid ELSE NULL END,
                    (slot_item->>'slot_number')::int,
                    'Discrepancy detected during audit');
        END IF;

        -- Replacements
        IF (slot_item->>'is_replacing_toy')::boolean = true AND (slot_item->>'replacement_product_id') IS NOT NULL THEN
            movement_qty := COALESCE((slot_item->>'removed_for_replacement')::int, 0);
            IF movement_qty > 0 THEN
                INSERT INTO public.toy_movements (visit_report_id, product_id, movement_type, quantity, company_id, spot_id, machine_id, slot_number, notes)
                VALUES (NEW.id, (slot_item->>'replacement_product_id')::uuid, 'replacement', movement_qty, v_company_id, NEW.spot_id,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create AFTER INSERT trigger for inventory processing
DROP TRIGGER IF EXISTS after_visit_report_insert ON public.visit_reports;
CREATE TRIGGER after_visit_report_insert
AFTER INSERT ON public.visit_reports
FOR EACH ROW
EXECUTE FUNCTION public.process_visit_report_inventory();

-- Drop the old trigger that conflicts
DROP TRIGGER IF EXISTS update_stats_after_visit ON public.visit_reports;