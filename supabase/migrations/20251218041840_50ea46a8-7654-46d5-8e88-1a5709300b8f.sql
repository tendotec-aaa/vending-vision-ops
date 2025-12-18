-- Drop the old check constraint and add the new one with slot_audit
ALTER TABLE public.toy_movements DROP CONSTRAINT IF EXISTS toy_movements_movement_type_check;

ALTER TABLE public.toy_movements ADD CONSTRAINT toy_movements_movement_type_check 
CHECK (movement_type = ANY (ARRAY['sale'::text, 'refill'::text, 'removal'::text, 'audit_adjustment'::text, 'replacement'::text, 'slot_audit'::text]));