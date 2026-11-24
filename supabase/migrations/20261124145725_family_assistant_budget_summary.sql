create or replace function public.get_family_budget_summary(p_family_id uuid)
returns table(monthly_spend numeric, order_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_family_member(p_family_id) then
    raise exception 'এই পরিবারের তথ্য দেখার অনুমতি নেই।';
  end if;
  return query
  select coalesce(sum(o.subtotal), 0)::numeric, count(o.id)::bigint
  from public.orders o
  where o.family_group_id = p_family_id
    and o.created_at >= date_trunc('month', now())
    and lower(coalesce(o.order_status,'')) not in ('cancelled','canceled','বাতিল')
    and lower(coalesce(o.payment_status,'')) not in ('rejected','refunded');
end;
$$;
revoke all on function public.get_family_budget_summary(uuid) from public, anon;
grant execute on function public.get_family_budget_summary(uuid) to authenticated;
revoke update on public.family_groups from authenticated;
grant update (name, monthly_budget, package_id, updated_at) on public.family_groups to authenticated;
