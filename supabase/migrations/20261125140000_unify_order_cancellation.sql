-- BazarBondhu: unify customer/admin order cancellation.
-- Apply this migration through the reviewed release process; do not run against production
-- until the migration has been reviewed and a restorable database backup is confirmed.

CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  p_order_id uuid,
  p_cancel_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order RECORD;
  v_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please login first';
  END IF;

  v_is_admin := public.is_admin();

  SELECT id, user_id, order_status, payment_status
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.user_id <> auth.uid() AND NOT v_is_admin THEN
    RAISE EXCEPTION 'You cannot cancel this order';
  END IF;

  -- A repeated request must never restore stock twice.
  IF v_order.order_status = 'cancelled' THEN
    RETURN TRUE;
  END IF;

  IF p_cancel_reason IS NULL OR pg_catalog.btrim(p_cancel_reason) = '' THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  IF pg_catalog.length(pg_catalog.btrim(p_cancel_reason)) > 500 THEN
    RAISE EXCEPTION 'Cancellation reason is too long';
  END IF;

  IF v_is_admin THEN
    IF v_order.order_status NOT IN ('pending', 'confirmed', 'processing') THEN
      RAISE EXCEPTION 'Only pending, confirmed or processing orders can be cancelled';
    END IF;
  ELSE
    IF v_order.user_id <> auth.uid() OR v_order.order_status <> 'pending' THEN
      RAISE EXCEPTION 'Customers can only cancel their own pending orders';
    END IF;
  END IF;

  -- A paid order must be refunded through the real payment channel first.
  -- A customer cannot self-declare a refund.
  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'This order is marked paid. Complete and verify the refund before cancelling';
  END IF;

  IF v_order.payment_status = 'refunded' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Only an admin can cancel a refunded order';
  END IF;

  UPDATE public.orders
  SET
    order_status = 'cancelled',
    cancel_reason = pg_catalog.btrim(p_cancel_reason)
  WHERE id = p_order_id;

  -- Restore only catalog products. Custom/free-text items have product_id NULL.
  -- The order row lock and the cancelled-state check above make this one-time.
  UPDATE public.products AS p
  SET stock = p.stock + items.total_quantity
  FROM (
    SELECT product_id, SUM(quantity)::INTEGER AS total_quantity
    FROM public.order_items
    WHERE order_id = p_order_id
      AND product_id IS NOT NULL
    GROUP BY product_id
  ) AS items
  WHERE p.id = items.product_id;

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_order_atomic(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_atomic(uuid, text) TO authenticated;
