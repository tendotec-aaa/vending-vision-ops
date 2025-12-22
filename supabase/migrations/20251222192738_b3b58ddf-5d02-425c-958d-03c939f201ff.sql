-- Drop the trigger that references non-existent updated_at column on machine_toy_slots
DROP TRIGGER IF EXISTS update_machine_toy_slots_updated_at ON public.machine_toy_slots;