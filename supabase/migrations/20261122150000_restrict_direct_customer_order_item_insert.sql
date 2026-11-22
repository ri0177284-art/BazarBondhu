-- Prevent customers from directly inserting order items.
-- Customer checkout must create order items through the validated SECURITY DEFINER
-- atomic checkout RPC; admins retain their trusted insert workflow.

DROP POLICY IF EXISTS "Consolidated order items insert" ON public.order_items;

CREATE POLICY "Consolidated order items insert"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_admin()));
