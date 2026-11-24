create or replace function public.create_family_order_atomic(
  p_family_id uuid, p_customer_name text, p_phone text, p_delivery_address text,
  p_payment_method text, p_transaction_id text, p_items jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_group public.family_groups%rowtype; v_order_id uuid;
begin
  if auth.uid() is null or not private.is_family_owner(p_family_id) then
    raise exception 'শুধু পরিবারের Owner চূড়ান্ত অর্ডার করতে পারবেন।';
  end if;
  select * into v_group from public.family_groups where id = p_family_id for update;
  if not found then raise exception 'পরিবারটি পাওয়া যায়নি।'; end if;
  v_order_id := public.create_order_with_payment_atomic(
    p_customer_name, p_phone, p_delivery_address, p_payment_method,
    0, 0, p_items, p_transaction_id, v_group.package_id
  );
  update public.orders set family_group_id = p_family_id
  where id = v_order_id and user_id = auth.uid();
  if not found then raise exception 'পরিবারের অর্ডার সংরক্ষণ করা যায়নি।'; end if;
  return v_order_id;
end;
$$;
revoke all on function public.create_family_order_atomic(uuid,text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.create_family_order_atomic(uuid,text,text,text,text,text,jsonb) to authenticated;
