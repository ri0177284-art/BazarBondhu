-- BazarBondhu Rewards foundation.
-- Legacy orders are intentionally not backfilled; only orders delivered after this migration earn points.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reward_discount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.reward_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_order_bonus_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_points_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('order_earn','first_order_bonus')),
  granted_points integer NOT NULL CHECK (granted_points > 0),
  remaining_points integer NOT NULL CHECK (remaining_points >= 0 AND remaining_points <= granted_points),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_order_id, source_type)
);

CREATE TABLE IF NOT EXISTS public.reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  lot_id uuid REFERENCES public.reward_points_lots(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earned','first_order_bonus','redeemed','expired','reversed')),
  points_delta integer NOT NULL CHECK (points_delta <> 0),
  amount_taka numeric NOT NULL DEFAULT 0,
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reward_transactions_user_created_idx
  ON public.reward_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reward_lots_user_expiry_idx
  ON public.reward_points_lots(user_id, expires_at, remaining_points);

ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_points_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own reward account" ON public.reward_accounts;
CREATE POLICY "Customers read own reward account" ON public.reward_accounts
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Customers read own reward lots" ON public.reward_points_lots;
CREATE POLICY "Customers read own reward lots" ON public.reward_points_lots
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Customers read own reward transactions" ON public.reward_transactions;
CREATE POLICY "Customers read own reward transactions" ON public.reward_transactions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.reward_accounts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.reward_points_lots FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.reward_transactions FROM anon, authenticated;
GRANT SELECT ON public.reward_accounts, public.reward_points_lots, public.reward_transactions TO authenticated;
