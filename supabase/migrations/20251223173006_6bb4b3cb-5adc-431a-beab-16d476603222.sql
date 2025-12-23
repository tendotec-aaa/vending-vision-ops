-- Drop and recreate the trigger function with correct column name
CREATE OR REPLACE FUNCTION public.update_spot_stats_after_visit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_units_sold integer;
  total_cogs numeric;
BEGIN
  -- Only process if spot_id is set
  IF NEW.spot_id IS NOT NULL THEN
    -- Calculate total units sold and COGS from visit_report_stock
    SELECT 
      COALESCE(SUM(vrs.units_sold), 0),
      COALESCE(SUM(vrs.units_sold * t.cogs), 0)
    INTO total_units_sold, total_cogs
    FROM public.visit_report_stock vrs
    JOIN public.toys t ON t.id = vrs.toy_id
    WHERE vrs.visit_report_id = NEW.id;
    
    -- Update spot stats - using total_cash_collected instead of total_cash_removed
    UPDATE public.location_spots
    SET 
      spot_last_visit_report = NEW.visit_date,
      spot_last_visit_report_id = NEW.id,
      spot_total_sales = COALESCE(spot_total_sales, 0) + COALESCE(NEW.total_cash_collected, 0)
    WHERE id = NEW.spot_id;
    
    -- Update location stats
    UPDATE public.locations
    SET 
      location_last_visit_report = NEW.visit_date,
      location_last_visit_report_id = NEW.id,
      location_total_sales = COALESCE(location_total_sales, 0) + COALESCE(NEW.total_cash_collected, 0),
      location_total_cogs = COALESCE(location_total_cogs, 0) + total_cogs
    WHERE id = NEW.location_id;
  ELSE
    -- No spot, just update location
    UPDATE public.locations
    SET 
      location_last_visit_report = NEW.visit_date,
      location_last_visit_report_id = NEW.id,
      location_total_sales = COALESCE(location_total_sales, 0) + COALESCE(NEW.total_cash_collected, 0)
    WHERE id = NEW.location_id;
  END IF;
  
  RETURN NEW;
END;
$function$;