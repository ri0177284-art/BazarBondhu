create or replace function public.create_family_group(p_name text,p_monthly_budget numeric default 5000,p_package_id text default 'family-monthly')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_family_id uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'লগইন করে পরিবার তৈরি করুন।'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then raise exception 'আপনি ইতিমধ্যে একটি পরিবারের সদস্য।'; end if;
  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  if pg_catalog.char_length(v_name) < 2 or pg_catalog.char_length(v_name) > 60 then raise exception 'পরিবারের নাম ২ থেকে ৬০ অক্ষরের মধ্যে দিন।'; end if;
  if p_monthly_budget is null or p_monthly_budget < 0 or p_monthly_budget > 10000000 then raise exception 'সঠিক বাজেট লিখুন।'; end if;
  if p_package_id not in ('family-monthly','weekly-family','budget-smart') then raise exception 'সঠিক প্যাকেজ নির্বাচন করুন।'; end if;
  insert into public.family_groups(name, owner_id, invite_code, monthly_budget, package_id)
  values (v_name, auth.uid(), pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 12)), p_monthly_budget, p_package_id)
  returning id into v_family_id;
  insert into public.family_members(family_id, user_id, role, display_name)
  values (v_family_id, auth.uid(), 'owner', (select nullif(pg_catalog.btrim(coalesce(p.full_name, '')), '') from public.profiles p where p.id = auth.uid()));
  return v_family_id;
end;
$$;
revoke all on function public.create_family_group(text,numeric,text) from public, anon;
grant execute on function public.create_family_group(text,numeric,text) to authenticated;
