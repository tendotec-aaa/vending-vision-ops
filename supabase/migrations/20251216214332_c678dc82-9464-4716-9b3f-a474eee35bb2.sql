-- Add statistics fields to location_spots
ALTER TABLE public.location_spots
ADD COLUMN IF NOT EXISTS spot_start_date date,
ADD COLUMN IF NOT EXISTS spot_last_visit_report timestamp with time zone,
ADD COLUMN IF NOT EXISTS spot_last_visit_report_id uuid REFERENCES public.visit_reports(id),
ADD COLUMN IF NOT EXISTS spot_total_sales numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS spot_total_rent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS spot_open_maintenance_tickets integer DEFAULT 0;

-- Add statistics fields to locations
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS location_last_visit_report timestamp with time zone,
ADD COLUMN IF NOT EXISTS location_last_visit_report_id uuid REFERENCES public.visit_reports(id),
ADD COLUMN IF NOT EXISTS location_total_sales numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS location_total_rent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS location_total_cogs numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS location_open_maintenance_tickets integer DEFAULT 0;

-- Initialize spot_start_date from location's start_date
UPDATE public.location_spots ls
SET spot_start_date = l.start_date
FROM public.locations l
WHERE ls.location_id = l.id AND ls.spot_start_date IS NULL;

-- Function to update spot statistics after visit report
CREATE OR REPLACE FUNCTION public.update_spot_stats_after_visit()
RETURNS TRIGGER AS $$
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
    
    -- Update spot stats
    UPDATE public.location_spots
    SET 
      spot_last_visit_report = NEW.visit_date,
      spot_last_visit_report_id = NEW.id,
      spot_total_sales = COALESCE(spot_total_sales, 0) + COALESCE(NEW.total_cash_removed, 0)
    WHERE id = NEW.spot_id;
    
    -- Update location stats
    UPDATE public.locations
    SET 
      location_last_visit_report = NEW.visit_date,
      location_last_visit_report_id = NEW.id,
      location_total_sales = COALESCE(location_total_sales, 0) + COALESCE(NEW.total_cash_removed, 0),
      location_total_cogs = COALESCE(location_total_cogs, 0) + total_cogs
    WHERE id = NEW.location_id;
  ELSE
    -- No spot, just update location
    UPDATE public.locations
    SET 
      location_last_visit_report = NEW.visit_date,
      location_last_visit_report_id = NEW.id,
      location_total_sales = COALESCE(location_total_sales, 0) + COALESCE(NEW.total_cash_removed, 0)
    WHERE id = NEW.location_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for visit reports
DROP TRIGGER IF EXISTS update_stats_after_visit_report ON public.visit_reports;
CREATE TRIGGER update_stats_after_visit_report
AFTER INSERT ON public.visit_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_spot_stats_after_visit();

-- Function to update maintenance ticket counts
CREATE OR REPLACE FUNCTION public.update_maintenance_ticket_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update location's open ticket count
  UPDATE public.locations l
  SET location_open_maintenance_tickets = (
    SELECT COUNT(*) 
    FROM public.work_orders wo 
    WHERE wo.location_id = l.id 
    AND wo.status IN ('pending', 'in_progress')
  )
  WHERE l.id = COALESCE(NEW.location_id, OLD.location_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for work orders
DROP TRIGGER IF EXISTS update_maintenance_counts ON public.work_orders;
CREATE TRIGGER update_maintenance_counts
AFTER INSERT OR UPDATE OR DELETE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_maintenance_ticket_counts();

-- Function to sync spot rent from location
CREATE OR REPLACE FUNCTION public.sync_spot_rent()
RETURNS TRIGGER AS $$
DECLARE
  spot_count integer;
  rent_per_spot numeric;
BEGIN
  -- Count spots for this location
  SELECT COUNT(*) INTO spot_count
  FROM public.location_spots
  WHERE location_id = NEW.id;
  
  IF spot_count > 0 AND NEW.rent_amount IS NOT NULL THEN
    rent_per_spot := NEW.rent_amount / spot_count;
    
    UPDATE public.location_spots
    SET spot_total_rent = rent_per_spot
    WHERE location_id = NEW.id;
  END IF;
  
  -- Calculate total rent for location (rent_amount * months since start)
  IF NEW.rent_amount IS NOT NULL AND NEW.start_date IS NOT NULL THEN
    UPDATE public.locations
    SET location_total_rent = NEW.rent_amount * 
      GREATEST(1, EXTRACT(MONTH FROM AGE(NOW(), NEW.start_date)) + 
      (EXTRACT(YEAR FROM AGE(NOW(), NEW.start_date)) * 12))
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for location rent updates
DROP TRIGGER IF EXISTS sync_rent_to_spots ON public.locations;
CREATE TRIGGER sync_rent_to_spots
AFTER INSERT OR UPDATE OF rent_amount ON public.locations
FOR EACH ROW
EXECUTE FUNCTION public.sync_spot_rent();