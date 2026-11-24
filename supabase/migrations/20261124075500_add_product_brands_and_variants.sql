ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS variant text;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS variant text;

CREATE OR REPLACE FUNCTION public.set_order_item_product_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product_name text;
  v_brand text;
  v_variant text;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT p.name, p.brand, p.variant
      INTO v_product_name, v_brand, v_variant
    FROM public.products AS p
    WHERE p.id = NEW.product_id;

    IF FOUND THEN
      NEW.brand := COALESCE(NULLIF(pg_catalog.btrim(NEW.brand), ''), v_brand);
      NEW.variant := COALESCE(NULLIF(pg_catalog.btrim(NEW.variant), ''), v_variant);

      IF NEW.brand IS NOT NULL OR NEW.variant IS NOT NULL THEN
        NEW.product_name := v_product_name || ' — ' ||
          pg_catalog.concat_ws(' ', NEW.brand, NEW.variant);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_order_item_product_variant ON public.order_items;

CREATE TRIGGER set_order_item_product_variant
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.set_order_item_product_variant();
