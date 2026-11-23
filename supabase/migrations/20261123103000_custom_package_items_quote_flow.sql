-- Customer-requested custom products for family package shopping lists.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS custom_items_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_custom_items_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_custom_items_status_check
  CHECK (custom_items_status IN ('none', 'pending', 'quoted', 'approved'));

CREATE OR REPLACE FUNCTION public.create_custom_package_order(
  p_customer_name text,
  p_phone text,
  p_delivery_address text,
  p_package_id text,
  p_catalog_items jsonb,
  p_custom_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_item record;
  v_product_name text;
  v_unit_price numeric;
  v_subtotal numeric := 0;
  v_service_charge numeric;
  v_delivery_fee numeric;
  v_custom_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please login first'; END IF;
  IF NOT public.is_admin() AND (p_customer_name IS NULL OR pg_catalog.btrim(p_customer_name) = '') THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF p_phone IS NULL OR pg_catalog.btrim(p_phone) = ''
     OR p_delivery_address IS NULL OR pg_catalog.btrim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'Customer information is required';
  END IF;
  IF p_package_id IS NULL OR p_package_id NOT IN ('family-monthly', 'weekly-family', 'budget-smart') THEN
    RAISE EXCEPTION 'A family package is required';
  END IF;
  IF p_catalog_items IS NULL OR pg_catalog.jsonb_typeof(p_catalog_items) <> 'array'
     OR p_custom_items IS NULL OR pg_catalog.jsonb_typeof(p_custom_items) <> 'array' THEN
    RAISE EXCEPTION 'Invalid shopping list';
  END IF;
  v_custom_count := pg_catalog.jsonb_array_length(p_custom_items);
  IF pg_catalog.jsonb_array_length(p_catalog_items) = 0 AND v_custom_count = 0 THEN
    RAISE EXCEPTION 'Shopping list is empty';
  END IF;
  IF v_custom_count > 30 THEN RAISE EXCEPTION 'সর্বোচ্চ ৩০টি নিজের পছন্দের পণ্য যোগ করা যাবে।'; END IF;

  FOR v_item IN
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_catalog_items) AS x(product_id uuid, quantity integer)
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity < 1 OR v_item.quantity > 10000 THEN
      RAISE EXCEPTION 'Invalid catalog product or quantity';
    END IF;
    SELECT p.name, p.price INTO v_product_name, v_unit_price
    FROM public.products p
    WHERE p.id = v_item.product_id AND p.is_active = true
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN RAISE EXCEPTION 'Invalid product price'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = v_item.product_id AND p.stock >= v_item.quantity
    ) THEN
      RAISE EXCEPTION 'Insufficient stock for product: %', v_product_name;
    END IF;
    v_subtotal := v_subtotal + v_unit_price * v_item.quantity;
  END LOOP;

  FOR v_item IN
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_custom_items) AS x(product_name text, quantity integer)
  LOOP
    IF v_item.product_name IS NULL OR pg_catalog.length(pg_catalog.btrim(v_item.product_name)) < 2
       OR pg_catalog.length(pg_catalog.btrim(v_item.product_name)) > 100
       OR v_item.quantity IS NULL OR v_item.quantity < 1 OR v_item.quantity > 1000 THEN
      RAISE EXCEPTION 'নিজের পণ্যের নাম (২–১০০ অক্ষর) ও সঠিক পরিমাণ দিন।';
    END IF;
  END LOOP;

  SELECT s.service_charge, s.delivery_fee INTO v_service_charge, v_delivery_fee
  FROM public.app_settings s WHERE s.id = 1 FOR SHARE;
  IF NOT FOUND OR v_service_charge IS NULL OR v_delivery_fee IS NULL
     OR v_service_charge < 0 OR v_delivery_fee < 0 THEN
    RAISE EXCEPTION 'Order settings are unavailable';
  END IF;

  INSERT INTO public.orders (
    user_id, customer_name, phone, delivery_address, payment_method,
    order_status, subtotal, service_charge, delivery_fee, total, payment_status,
    package_id, custom_items_status
  ) VALUES (
    auth.uid(), pg_catalog.btrim(p_customer_name), pg_catalog.btrim(p_phone),
    pg_catalog.btrim(p_delivery_address), 'cod', 'pending', v_subtotal,
    v_service_charge, v_delivery_fee, v_subtotal + v_service_charge + v_delivery_fee,
    'pending', p_package_id, 'pending'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_catalog_items) AS x(product_id uuid, quantity integer)
  LOOP
    SELECT p.name, p.price INTO v_product_name, v_unit_price
    FROM public.products p WHERE p.id = v_item.product_id AND p.is_active = true;
    UPDATE public.products
      SET stock = stock - v_item.quantity
      WHERE id = v_item.product_id AND is_active = true AND stock >= v_item.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for product: %', v_product_name; END IF;
    INSERT INTO public.order_items(order_id, product_id, product_name, quantity, unit_price, line_total)
    VALUES (v_order_id, v_item.product_id, v_product_name, v_item.quantity, v_unit_price, v_unit_price * v_item.quantity);
  END LOOP;

  FOR v_item IN
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_custom_items) AS x(product_name text, quantity integer)
  LOOP
    INSERT INTO public.order_items(order_id, product_id, product_name, quantity, unit_price, line_total)
    VALUES (v_order_id, NULL, pg_catalog.btrim(v_item.product_name), v_item.quantity, 0, 0);
  END LOOP;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_custom_package_order(text,text,text,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_custom_package_order(text,text,text,text,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_quote_custom_package_order(
  p_order_id uuid,
  p_custom_prices jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item record;
  v_count integer;
  v_subtotal numeric;
  v_service numeric;
  v_delivery numeric;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_custom_prices IS NULL OR pg_catalog.jsonb_typeof(p_custom_prices) <> 'array'
     OR pg_catalog.jsonb_array_length(p_custom_prices) = 0 THEN
    RAISE EXCEPTION 'Custom item prices are required';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.custom_items_status <> 'pending' THEN
    RAISE EXCEPTION 'Custom order is not awaiting a quote';
  END IF;

  SELECT count(*) INTO v_count FROM public.order_items
  WHERE order_id = p_order_id AND product_id IS NULL;
  IF v_count <> pg_catalog.jsonb_array_length(p_custom_prices) THEN
    RAISE EXCEPTION 'সব নিজের পছন্দের পণ্যের দাম দিতে হবে।';
  END IF;

  FOR v_item IN
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_custom_prices) AS x(item_id uuid, unit_price numeric)
  LOOP
    IF v_item.unit_price IS NULL OR v_item.unit_price <= 0 OR v_item.unit_price > 1000000 THEN
      RAISE EXCEPTION 'প্রতিটি পণ্যের সঠিক দাম দিন।';
    END IF;
    UPDATE public.order_items
      SET unit_price = v_item.unit_price, line_total = v_item.unit_price * quantity
      WHERE id = v_item.item_id AND order_id = p_order_id AND product_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Custom order item not found'; END IF;
  END LOOP;

  SELECT COALESCE(sum(line_total), 0) INTO v_subtotal
  FROM public.order_items WHERE order_id = p_order_id;

  IF v_order.package_id IS NULL AND v_subtotal < 99 THEN
    RAISE EXCEPTION 'সাধারণ অর্ডারে পণ্যের ন্যূনতম মূল্য ৯৯ টাকা।';
  ELSIF v_order.package_id = 'weekly-family' AND v_subtotal < 1000 THEN
    RAISE EXCEPTION 'সাপ্তাহিক প্যাকেজে পণ্যের ন্যূনতম মূল্য ১০০০ টাকা।';
  ELSIF v_order.package_id = 'family-monthly' AND v_subtotal < 2000 THEN
    RAISE EXCEPTION 'মাসিক প্যাকেজে পণ্যের ন্যূনতম মূল্য ২০০০ টাকা।';
  ELSIF v_order.package_id = 'budget-smart' AND v_subtotal < 500 THEN
    RAISE EXCEPTION 'Budget Smart থেকে অর্ডার করতে পণ্যের ন্যূনতম মূল্য ৫০০ টাকা।';
  END IF;

  v_service := v_order.service_charge;
  v_delivery := v_order.delivery_fee;
  IF v_order.package_id = 'family-monthly' AND v_subtotal >= 5000 THEN
    v_service := 11; v_delivery := 11;
  ELSIF v_order.package_id = 'weekly-family' AND v_subtotal >= 2000 THEN
    v_service := 20; v_delivery := 40;
  END IF;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      service_charge = v_service,
      delivery_fee = v_delivery,
      total = v_subtotal + v_service + v_delivery - reward_discount,
      custom_items_status = 'quoted'
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_quote_custom_package_order(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_quote_custom_package_order(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_custom_package_quote(
  p_order_id uuid,
  p_payment_method text,
  p_transaction_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please login first'; END IF;
  IF p_payment_method NOT IN ('cod','bkash','nagad') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF p_payment_method IN ('bkash','nagad')
     AND (p_transaction_id IS NULL OR pg_catalog.btrim(p_transaction_id) = '') THEN
    RAISE EXCEPTION 'Transaction ID is required';
  END IF;
  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND OR v_order.custom_items_status <> 'quoted' OR v_order.order_status <> 'pending' THEN
    RAISE EXCEPTION 'এই অর্ডারের কোট অনুমোদনের জন্য প্রস্তুত নয়।';
  END IF;

  UPDATE public.orders
  SET payment_method = p_payment_method,
      transaction_id = CASE WHEN p_payment_method IN ('bkash','nagad') THEN pg_catalog.btrim(p_transaction_id) ELSE NULL END,
      custom_items_status = 'approved',
      order_status = 'confirmed',
      confirmed_at = now()
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_custom_package_quote(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_custom_package_quote(uuid,text,text) TO authenticated;
