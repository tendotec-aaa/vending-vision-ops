-- Create trigger to auto-update maintenance ticket counts when work_orders change
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

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS work_orders_update_ticket_counts ON public.work_orders;

-- Create trigger for insert, update, delete on work_orders
CREATE TRIGGER work_orders_update_ticket_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_maintenance_ticket_counts();

-- Add spot_id column to work_orders to track which spot has the issue
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS spot_id uuid REFERENCES public.location_spots(id);

-- Create function to update spot ticket counts
CREATE OR REPLACE FUNCTION public.update_spot_ticket_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update old spot if changed
  IF OLD IS NOT NULL AND OLD.spot_id IS NOT NULL THEN
    UPDATE public.location_spots ls
    SET spot_open_maintenance_tickets = (
      SELECT COUNT(*) 
      FROM public.work_orders wo 
      WHERE wo.spot_id = ls.id 
      AND wo.status IN ('pending', 'in_progress')
    )
    WHERE ls.id = OLD.spot_id;
  END IF;
  
  -- Update new spot
  IF NEW IS NOT NULL AND NEW.spot_id IS NOT NULL THEN
    UPDATE public.location_spots ls
    SET spot_open_maintenance_tickets = (
      SELECT COUNT(*) 
      FROM public.work_orders wo 
      WHERE wo.spot_id = ls.id 
      AND wo.status IN ('pending', 'in_progress')
    )
    WHERE ls.id = NEW.spot_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for spot counts
DROP TRIGGER IF EXISTS work_orders_update_spot_ticket_counts ON public.work_orders;
CREATE TRIGGER work_orders_update_spot_ticket_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_spot_ticket_counts();