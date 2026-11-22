-- Rewards are private: authenticated users can only read rows allowed by RLS; anon has no access.
REVOKE ALL ON public.reward_accounts FROM anon, authenticated;
REVOKE ALL ON public.reward_points_lots FROM anon, authenticated;
REVOKE ALL ON public.reward_transactions FROM anon, authenticated;
GRANT SELECT ON public.reward_accounts, public.reward_points_lots, public.reward_transactions TO authenticated;
