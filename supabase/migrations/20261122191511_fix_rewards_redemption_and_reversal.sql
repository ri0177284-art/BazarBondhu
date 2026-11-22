-- Secure server-side reward accrual, expiry, redemption and admin reporting.
CREATE OR REPLACE FUNCTION public.expire_reward_points(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_lot record;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOR v_lot IN
    SELECT id, remaining_points FROM public.reward_points_lots
    WHERE user_id = p_user_id AND remaining_points > 0 AND expires_at <= now()
    FOR UPDATE
  LOOP
    UPDATE public.reward_points_lots SET remaining_points = 0 WHERE id = v_lot.id;
    INSERT INTO public.reward_transactions(user_id,lot_id,transaction_type,points_delta,amount_taka,note)
    VALUES(p_user_id,v_lot.id,'expired',-v_lot.remaining_points,0,'পয়েন্টের মেয়াদ শেষ');
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_order_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_points integer := 0;
  v_lot_id uuid;
  v_bonus_allowed boolean := false;
  v_lot record;
  v_expiry timestamptz := now() + interval '12 months';
BEGIN
  IF NEW.order_status = 'delivered'
     AND NEW.payment_status NOT IN ('rejected','refunded')
     AND OLD.order_status IS DISTINCT FROM NEW.order_status THEN
    v_points := CASE
      WHEN NEW.subtotal >= 10000 THEN 600
      WHEN NEW.subtotal >= 5000 THEN 300
      WHEN NEW.subtotal >= 3000 THEN 180
      WHEN NEW.subtotal >= 2000 THEN 120
      WHEN NEW.subtotal >= 1000 THEN 60
      WHEN NEW.subtotal >= 500 THEN 30
      WHEN NEW.subtotal >= 300 THEN 15
      WHEN NEW.subtotal >= 99 THEN 5 ELSE 0 END;
    IF v_points > 0 THEN
      INSERT INTO public.reward_points_lots(user_id,source_order_id,source_type,granted_points,remaining_points,expires_at)
      VALUES(NEW.user_id,NEW.id,'order_earn',v_points,v_points,v_expiry)
      ON CONFLICT(user_id,source_order_id,source_type) DO NOTHING
      RETURNING id INTO v_lot_id;
      IF v_lot_id IS NOT NULL THEN
        INSERT INTO public.reward_transactions(user_id,order_id,lot_id,transaction_type,points_delta,amount_taka,expires_at,note)
        VALUES(NEW.user_id,NEW.id,v_lot_id,'earned',v_points,0,v_expiry,'অর্ডার সম্পন্ন হওয়ার Reward');
      END IF;
    END IF;
    INSERT INTO public.reward_accounts(user_id) VALUES(NEW.user_id) ON CONFLICT(user_id) DO NOTHING;
    SELECT NOT first_order_bonus_awarded INTO v_bonus_allowed
    FROM public.reward_accounts WHERE user_id=NEW.user_id FOR UPDATE;
    IF COALESCE(v_bonus_allowed,false) THEN
      UPDATE public.reward_accounts SET first_order_bonus_awarded=true,updated_at=now() WHERE user_id=NEW.user_id;
      INSERT INTO public.reward_points_lots(user_id,source_order_id,source_type,granted_points,remaining_points,expires_at)
      VALUES(NEW.user_id,NEW.id,'first_order_bonus',50,50,v_expiry)
      ON CONFLICT(user_id,source_order_id,source_type) DO NOTHING
      RETURNING id INTO v_lot_id;
      IF v_lot_id IS NOT NULL THEN
        INSERT INTO public.reward_transactions(user_id,order_id,lot_id,transaction_type,points_delta,amount_taka,expires_at,note)
        VALUES(NEW.user_id,NEW.id,v_lot_id,'first_order_bonus',50,0,v_expiry,'প্রথম সফল অর্ডারের বোনাস');
      END IF;
    END IF;
  ELSIF OLD.order_status='delivered'
     AND (NEW.order_status IN ('cancelled','canceled') OR NEW.payment_status IN ('rejected','refunded')) THEN
    FOR v_lot IN
      SELECT id,remaining_points FROM public.reward_points_lots
      WHERE source_order_id=NEW.id AND remaining_points>0 FOR UPDATE
    LOOP
      UPDATE public.reward_points_lots SET remaining_points=0 WHERE id=v_lot.id;
      INSERT INTO public.reward_transactions(user_id,order_id,lot_id,transaction_type,points_delta,amount_taka,note)
      VALUES(NEW.user_id,NEW.id,v_lot.id,'reversed',-v_lot.remaining_points,0,'অর্ডার বাতিল/রিফান্ড হওয়ায় অব্যবহৃত পয়েন্ট বাতিল');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_order_rewards ON public.orders;
CREATE TRIGGER trg_award_order_rewards
AFTER UPDATE OF order_status,payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.award_order_rewards();

CREATE OR REPLACE FUNCTION public.rewards_get_my_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_lifetime_earned integer;
  v_lifetime_redeemed integer;
  v_history jsonb;
  v_expiring integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Please login first'; END IF;
  PERFORM public.expire_reward_points(v_user_id);
  SELECT COALESCE(sum(remaining_points),0)::integer INTO v_balance
  FROM public.reward_points_lots WHERE user_id=v_user_id AND expires_at>now();
  SELECT COALESCE(sum(points_delta) FILTER(WHERE points_delta>0),0)::integer,
         COALESCE(abs(sum(points_delta) FILTER(WHERE transaction_type='redeemed')),0)::integer
  INTO v_lifetime_earned,v_lifetime_redeemed
  FROM public.reward_transactions WHERE user_id=v_user_id;
  SELECT COALESCE(sum(remaining_points),0)::integer INTO v_expiring
  FROM public.reward_points_lots WHERE user_id=v_user_id AND expires_at>now()
    AND expires_at<=now()+interval '30 days';
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',t.id,'type',t.transaction_type,'points',t.points_delta,'note',t.note,
    'created_at',t.created_at,'expires_at',t.expires_at,'order_id',t.order_id
  ) ORDER BY t.created_at DESC),'[]'::jsonb) INTO v_history
  FROM (SELECT * FROM public.reward_transactions WHERE user_id=v_user_id ORDER BY created_at DESC LIMIT 50) t;
  RETURN jsonb_build_object('balance',v_balance,'balance_taka',floor(v_balance/10.0),
    'lifetime_earned',v_lifetime_earned,'lifetime_redeemed',v_lifetime_redeemed,
    'expiring_30_days',v_expiring,'history',v_history);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rewards_admin_overview()
RETURNS TABLE(user_id uuid,full_name text,phone text,points_balance integer,lifetime_earned integer,lifetime_redeemed integer,first_order_bonus_awarded boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN QUERY
  SELECT p.id,COALESCE(p.full_name,''),COALESCE(p.phone,''),
    COALESCE((SELECT sum(l.remaining_points)::integer FROM public.reward_points_lots l WHERE l.user_id=p.id AND l.expires_at>now()),0),
    COALESCE((SELECT sum(t.points_delta)::integer FROM public.reward_transactions t WHERE t.user_id=p.id AND t.points_delta>0),0),
    COALESCE((SELECT abs(sum(t.points_delta))::integer FROM public.reward_transactions t WHERE t.user_id=p.id AND t.transaction_type='redeemed'),0),
    COALESCE(a.first_order_bonus_awarded,false)
  FROM public.profiles p LEFT JOIN public.reward_accounts a ON a.user_id=p.id
  WHERE p.role<>'admin' ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_order_with_payment_atomic(
  p_customer_name text,p_phone text,p_delivery_address text,p_payment_method text,
  p_service_charge numeric,p_delivery_fee numeric,p_items jsonb,p_transaction_id text,
  p_package_id text,p_reward_points integer
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_order_id uuid;
  v_subtotal numeric;
  v_points_to_redeem integer := COALESCE(p_reward_points,0);
  v_points_available integer;
  v_points_left integer;
  v_take integer;
  v_discount numeric;
  v_lot record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please login first'; END IF;
  IF v_points_to_redeem<0 OR (v_points_to_redeem>0 AND (v_points_to_redeem<100 OR v_points_to_redeem%10<>0)) THEN
    RAISE EXCEPTION 'কমপক্ষে ১০০ পয়েন্ট এবং ১০-এর গুণিতক ব্যবহার করুন।';
  END IF;
  v_order_id:=public.create_order_with_payment_atomic(
    p_customer_name,p_phone,p_delivery_address,p_payment_method,p_service_charge,
    p_delivery_fee,p_items,p_transaction_id,p_package_id);
  IF v_points_to_redeem=0 THEN RETURN v_order_id; END IF;
  SELECT subtotal INTO v_subtotal FROM public.orders WHERE id=v_order_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  PERFORM public.expire_reward_points(auth.uid());
  PERFORM 1 FROM public.reward_points_lots
    WHERE user_id=auth.uid() AND remaining_points>0 AND expires_at>now() FOR UPDATE;
  SELECT COALESCE(sum(remaining_points),0)::integer INTO v_points_available
  FROM public.reward_points_lots WHERE user_id=auth.uid() AND remaining_points>0 AND expires_at>now();
  IF v_points_to_redeem>v_points_available THEN RAISE EXCEPTION 'আপনার পর্যাপ্ত Reward পয়েন্ট নেই।'; END IF;
  IF v_points_to_redeem>floor(v_subtotal*0.10)*10 THEN
    RAISE EXCEPTION 'একটি অর্ডারে পণ্যমূল্যের সর্বোচ্চ ১০%% পর্যন্ত Reward ব্যবহার করা যাবে।';
  END IF;
  v_discount:=v_points_to_redeem/10.0;
  v_points_left:=v_points_to_redeem;
  FOR v_lot IN
    SELECT id,remaining_points,expires_at FROM public.reward_points_lots
    WHERE user_id=auth.uid() AND remaining_points>0 AND expires_at>now()
    ORDER BY expires_at ASC,created_at ASC FOR UPDATE
  LOOP
    EXIT WHEN v_points_left<=0;
    v_take:=LEAST(v_points_left,v_lot.remaining_points);
    UPDATE public.reward_points_lots SET remaining_points=remaining_points-v_take WHERE id=v_lot.id;
    INSERT INTO public.reward_transactions(user_id,order_id,lot_id,transaction_type,points_delta,amount_taka,expires_at,note)
    VALUES(auth.uid(),v_order_id,v_lot.id,'redeemed',-v_take,v_take/10.0,v_lot.expires_at,'চেকআউটে Reward পয়েন্ট ব্যবহার');
    v_points_left:=v_points_left-v_take;
  END LOOP;
  UPDATE public.orders SET reward_discount=v_discount,total=total-v_discount WHERE id=v_order_id;
  RETURN v_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_reward_points(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.award_order_rewards() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rewards_get_my_summary() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.rewards_admin_overview() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_order_with_payment_atomic(text,text,text,text,numeric,numeric,jsonb,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rewards_get_my_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rewards_admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_payment_atomic(text,text,text,text,numeric,numeric,jsonb,text,text,integer) TO authenticated;
