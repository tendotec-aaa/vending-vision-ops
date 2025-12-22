
-- Create the submit_report_log_book table to track all changes from report submissions
CREATE TABLE public.submit_report_log_book (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_report_id uuid NOT NULL,
    company_id uuid NOT NULL,
    employee_id uuid,
    submitted_at timestamp with time zone NOT NULL DEFAULT now(),
    
    -- Track created records
    created_visit_report_id uuid,
    created_visit_report_stock_ids uuid[] DEFAULT '{}',
    created_work_order_ids uuid[] DEFAULT '{}',
    created_machine_toy_movement_ids uuid[] DEFAULT '{}',
    
    -- Track updated records with their previous values (JSONB for flexibility)
    updated_machine_toy_slots jsonb DEFAULT '[]', -- [{id, previous_values: {current_stock, toy_id, capacity, price_per_unit, last_refill_date}}]
    updated_location_spots jsonb DEFAULT '[]', -- [{id, previous_values: {spot_last_visit_report, spot_last_visit_report_id, spot_total_sales}}]
    updated_locations jsonb DEFAULT '[]', -- [{id, previous_values: {location_last_visit_report, location_last_visit_report_id, location_total_sales}}]
    
    -- Storage file path for potential deletion
    uploaded_photo_path text,
    
    -- Rollback status
    is_rolled_back boolean DEFAULT false,
    rolled_back_at timestamp with time zone,
    rolled_back_by uuid,
    rollback_notes text,
    
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.submit_report_log_book ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage log book"
ON public.submit_report_log_book
FOR ALL
USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can view log book in their company"
ON public.submit_report_log_book
FOR SELECT
USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- Function to rollback a visit report submission
CREATE OR REPLACE FUNCTION public.rollback_visit_report(
    p_log_id uuid,
    p_rollback_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_record submit_report_log_book%ROWTYPE;
    v_slot_update jsonb;
    v_spot_update jsonb;
    v_location_update jsonb;
BEGIN
    -- Get the log record
    SELECT * INTO v_log_record FROM submit_report_log_book WHERE id = p_log_id;
    
    IF v_log_record IS NULL THEN
        RAISE EXCEPTION 'Log record not found';
    END IF;
    
    IF v_log_record.is_rolled_back THEN
        RAISE EXCEPTION 'This submission has already been rolled back';
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.rollback_visit_report(uuid, text) TO authenticated;

-- Create index for faster lookups
CREATE INDEX idx_submit_report_log_book_visit_report ON public.submit_report_log_book(visit_report_id);
CREATE INDEX idx_submit_report_log_book_company ON public.submit_report_log_book(company_id);
CREATE INDEX idx_submit_report_log_book_submitted_at ON public.submit_report_log_book(submitted_at DESC);
