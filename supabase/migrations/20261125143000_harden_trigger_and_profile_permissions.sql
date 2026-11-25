-- BazarBondhu security hardening: restrict trigger-only function and profile self-insert.
-- This migration is intentionally additive and does not modify customer/order data.

-- Trigger functions are invoked by their attached triggers; API clients must not call them directly.
REVOKE ALL ON FUNCTION public.set_order_item_product_variant() FROM PUBLIC, anon, authenticated;

-- A user may create only their own customer profile. Admin provisioning remains permitted.
-- The auth.users insert trigger creates the normal customer profile under its SECURITY DEFINER owner.
DROP POLICY IF EXISTS "Consolidated profiles insert" ON public.profiles;

CREATE POLICY "Consolidated profiles insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_admin())
  OR (
    id = (SELECT auth.uid())
    AND role = 'customer'
  )
);
