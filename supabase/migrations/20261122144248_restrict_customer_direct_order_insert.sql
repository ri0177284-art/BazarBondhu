-- Customers must create orders through the validated atomic checkout RPC.
-- Keep direct table inserts available only to admins for trusted admin workflows.
DROP POLICY IF EXISTS "Consolidated orders insert" ON public.orders;

CREATE POLICY "Consolidated orders insert"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_admin()));
