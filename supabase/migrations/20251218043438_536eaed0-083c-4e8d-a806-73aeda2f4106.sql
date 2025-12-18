-- Drop the BEFORE trigger that incorrectly tries to insert toy_movements before visit_report exists
DROP TRIGGER IF EXISTS process_visit_report_inventory_trigger ON public.visit_reports;

-- Ensure the AFTER trigger exists and is correct
DROP TRIGGER IF EXISTS after_visit_report_insert ON public.visit_reports;
CREATE TRIGGER after_visit_report_insert
    AFTER INSERT ON public.visit_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.process_visit_report_inventory();