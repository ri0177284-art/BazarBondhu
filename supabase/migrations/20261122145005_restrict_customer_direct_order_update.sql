DROP POLICY IF EXISTS "Consolidated orders update" ON public.orders;

CREATE POLICY "Consolidated orders update"
ON public.orders
FOR UPDATE
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));
