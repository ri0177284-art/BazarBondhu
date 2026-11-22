CREATE OR REPLACE FUNCTION public.create_order_with_payment_atomic(
  p_customer_name text,
  p_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_service_charge numeric,
  p_delivery_fee numeric,
  p_items jsonb,
  p_transaction_id text,
  p_package_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_service_charge numeric;
  v_delivery_fee numeric;
  v_item record;
  v_product_name text;
  v_unit_price numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please login first';
  END IF;

  IF p_customer_name IS NULL OR pg_catalog.btrim(p_customer_name) = ''
     OR p_phone IS NULL OR pg_catalog.btrim(p_phone) = ''
     OR p_delivery_address IS NULL OR pg_catalog.btrim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'Customer information is required';
  END IF;

  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cod', 'bkash', 'nagad') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  IF p_payment_method IN ('bkash', 'nagad')
     AND (p_transaction_id IS NULL OR pg_catalog.btrim(p_transaction_id) = '') THEN
    RAISE EXCEPTION 'Transaction ID is required';
  END IF;

  IF p_package_id IS NOT NULL
     AND p_package_id NOT IN ('family-monthly', 'weekly-family', 'budget-smart') THEN
    RAISE EXCEPTION 'Invalid family package';
  END IF;

  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array'
     OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  SELECT s.service_charge, s.delivery_fee
    INTO v_service_charge, v_delivery_fee
  FROM public.app_settings AS s
  WHERE s.id = 1
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order settings are unavailable';
  END IF;

  IF v_service_charge IS NULL OR v_service_charge < 0
     OR v_delivery_fee IS NULL OR v_delivery_fee < 0 THEN
    RAISE EXCEPTION 'Invalid order charges in settings';
  END IF;

  -- Calculate subtotal from current database prices and lock products.
  FOR v_item IN
    SELECT *
    FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
      product_id uuid,
      product_name text,
      quantity integer,
      unit_price numeric
    )
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid product or quantity';
    END IF;

    SELECT p.name, p.price
      INTO v_product_name, v_unit_price
    FROM public.products AS p
    WHERE p.id = v_item.product_id
      AND p.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product is unavailable';
    END IF;

    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Invalid product price';
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_item.quantity);
  END LOOP;

  -- All package minimums use product subtotal only; delivery and service fees are excluded.
  IF p_package_id = 'weekly-family' AND v_subtotal < 1000 THEN
    RAISE EXCEPTION 'সাপ্তাহিক প্যাকেজে পণ্যের ন্যূনতম মূল্য ১০০০ টাকা।';
  ELSIF p_package_id = 'family-monthly' AND v_subtotal < 2000 THEN
    RAISE EXCEPTION 'মাসিক প্যাকেজে পণ্যের ন্যূনতম মূল্য ২০০০ টাকা।';
  ELSIF p_package_id = 'budget-smart' AND v_subtotal < 500 THEN
    RAISE EXCEPTION 'Budget Smart থেকে অর্ডার করতে পণ্যের ন্যূনতম মূল্য ৫০০ টাকা।';
  END IF;

  INSERT INTO public.orders (
    user_id, customer_name, phone, delivery_address, payment_method,
    transaction_id, package_id, order_status, subtotal, service_charge,
    delivery_fee, total, payment_status
  )
  VALUES (
    auth.uid(), pg_catalog.btrim(p_customer_name), pg_catalog.btrim(p_phone),
    pg_catalog.btrim(p_delivery_address), p_payment_method,
    CASE
      WHEN p_payment_method IN ('bkash', 'nagad') THEN pg_catalog.btrim(p_transaction_id)
      ELSE NULL
    END,
    p_package_id, 'pending', v_subtotal, v_service_charge, v_delivery_fee,
    v_subtotal + v_service_charge + v_delivery_fee, 'pending'
  )
  RETURNING id INTO v_order_id;

  -- Persist database product name and price; ignore client-supplied values.
  FOR v_item IN
    SELECT *
    FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
      product_id uuid,
      product_name text,
      quantity integer,
      unit_price numeric
    )
  LOOP
    SELECT p.name, p.price
      INTO v_product_name, v_unit_price
    FROM public.products AS p
    WHERE p.id = v_item.product_id
      AND p.is_active = true;

    UPDATE public.products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id
      AND is_active = true
      AND stock >= v_item.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for product: %', v_product_name;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price, line_total
    )
    VALUES (
      v_order_id, v_item.product_id, v_product_name, v_item.quantity,
      v_unit_price, v_unit_price * v_item.quantity
    );
  END LOOP;

  RETURN v_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_order_with_payment_atomic(
  text, text, text, text, numeric, numeric, jsonb, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_order_with_payment_atomic(
  text, text, text, text, numeric, numeric, jsonb, text, text
) TO authenticated;
