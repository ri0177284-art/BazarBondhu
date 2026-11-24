create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  monthly_budget numeric(12,2) not null default 5000 check (monthly_budget >= 0 and monthly_budget <= 10000000),
  package_id text not null default 'family-monthly' check (package_id in ('family-monthly','weekly-family','budget-smart')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family_groups(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  display_name text,
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create unique index if not exists family_members_one_owner_per_group
  on public.family_members(family_id) where role = 'owner';

create table if not exists public.family_shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family_groups(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  custom_name text,
  quantity integer not null check (quantity between 1 and 10000),
  added_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_shopping_item_product_or_custom check (
    (product_id is not null and custom_name is null) or
    (product_id is null and custom_name is not null and char_length(btrim(custom_name)) between 2 and 100)
  )
);
create unique index if not exists family_shopping_items_unique_product
  on public.family_shopping_items(family_id, product_id) where product_id is not null;
create index if not exists family_shopping_items_family_created
  on public.family_shopping_items(family_id, created_at);

create table if not exists public.family_product_preferences (
  family_id uuid not null references public.family_groups(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  preferred_brand text,
  preferred_variant text,
  stock_threshold integer not null default 5 check (stock_threshold between 0 and 10000),
  reminder_enabled boolean not null default true,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (family_id, product_id)
);

alter table public.orders add column if not exists family_group_id uuid references public.family_groups(id) on delete set null;
create index if not exists orders_family_group_created on public.orders(family_group_id, created_at desc);

create or replace function private.is_family_member(p_family_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = (select auth.uid()));
$$;

create or replace function private.is_family_owner(p_family_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = (select auth.uid()) and fm.role = 'owner');
$$;
revoke all on function private.is_family_member(uuid) from public, anon;
revoke all on function private.is_family_owner(uuid) from public, anon;
grant execute on function private.is_family_member(uuid) to authenticated;
grant execute on function private.is_family_owner(uuid) to authenticated;

alter table public.family_groups enable row level security;
alter table public.family_members enable row level security;
alter table public.family_shopping_items enable row level security;
alter table public.family_product_preferences enable row level security;

drop policy if exists family_groups_member_read on public.family_groups;
create policy family_groups_member_read on public.family_groups
  for select to authenticated using (private.is_family_member(id));
drop policy if exists family_groups_owner_update on public.family_groups;
create policy family_groups_owner_update on public.family_groups
  for update to authenticated using (private.is_family_owner(id))
  with check (private.is_family_owner(id));

drop policy if exists family_members_member_read on public.family_members;
create policy family_members_member_read on public.family_members
  for select to authenticated using (private.is_family_member(family_id));
drop policy if exists family_members_member_leave on public.family_members;
create policy family_members_member_leave on public.family_members
  for delete to authenticated using (
    (user_id = (select auth.uid()) and role = 'member')
    or (private.is_family_owner(family_id) and user_id <> (select auth.uid()))
  );

drop policy if exists family_items_member_read on public.family_shopping_items;
create policy family_items_member_read on public.family_shopping_items
  for select to authenticated using (private.is_family_member(family_id));
drop policy if exists family_items_member_insert on public.family_shopping_items;
create policy family_items_member_insert on public.family_shopping_items
  for insert to authenticated with check (
    private.is_family_member(family_id) and added_by = (select auth.uid()) and updated_by = (select auth.uid())
  );
drop policy if exists family_items_member_update on public.family_shopping_items;
create policy family_items_member_update on public.family_shopping_items
  for update to authenticated using (private.is_family_member(family_id))
  with check (private.is_family_member(family_id) and updated_by = (select auth.uid()));
drop policy if exists family_items_member_delete on public.family_shopping_items;
create policy family_items_member_delete on public.family_shopping_items
  for delete to authenticated using (private.is_family_member(family_id));

drop policy if exists family_preferences_member_read on public.family_product_preferences;
create policy family_preferences_member_read on public.family_product_preferences
  for select to authenticated using (private.is_family_member(family_id));
drop policy if exists family_preferences_member_insert on public.family_product_preferences;
create policy family_preferences_member_insert on public.family_product_preferences
  for insert to authenticated with check (private.is_family_member(family_id) and updated_by = (select auth.uid()));
drop policy if exists family_preferences_member_update on public.family_product_preferences;
create policy family_preferences_member_update on public.family_product_preferences
  for update to authenticated using (private.is_family_member(family_id))
  with check (private.is_family_member(family_id) and updated_by = (select auth.uid()));
drop policy if exists family_preferences_member_delete on public.family_product_preferences;
create policy family_preferences_member_delete on public.family_product_preferences
  for delete to authenticated using (private.is_family_member(family_id));

grant select, update on public.family_groups to authenticated;
revoke update on public.family_groups from authenticated;
grant update (name, monthly_budget, package_id, updated_at) on public.family_groups to authenticated;
grant select, delete on public.family_members to authenticated;
grant select, insert, update, delete on public.family_shopping_items to authenticated;
grant select, insert, update, delete on public.family_product_preferences to authenticated;

create or replace function public.create_family_group(p_name text, p_monthly_budget numeric default 5000, p_package_id text default 'family-monthly')
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
  values (v_name, auth.uid(), pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 8)), p_monthly_budget, p_package_id)
  returning id into v_family_id;
  insert into public.family_members(family_id, user_id, role, display_name)
  values (v_family_id, auth.uid(), 'owner',
    (select nullif(pg_catalog.btrim(coalesce(p.full_name, '')), '') from public.profiles p where p.id = auth.uid()));
  return v_family_id;
end;
$$;

create or replace function public.join_family_group(p_invite_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_family_id uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'লগইন করে পরিবারে যোগ দিন।'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then raise exception 'আপনি ইতিমধ্যে একটি পরিবারের সদস্য।'; end if;
  select fg.id into v_family_id from public.family_groups fg
  where fg.invite_code = pg_catalog.upper(pg_catalog.btrim(coalesce(p_invite_code, ''))) limit 1;
  if v_family_id is null then raise exception 'ইনভাইট কোডটি সঠিক নয়।'; end if;
  select nullif(pg_catalog.btrim(coalesce(p.full_name, '')), '') into v_name from public.profiles p where p.id = auth.uid();
  insert into public.family_members(family_id, user_id, role, display_name) values (v_family_id, auth.uid(), 'member', v_name);
  return v_family_id;
end;
$$;

create or replace function public.family_add_shopping_item(p_family_id uuid, p_product_id uuid, p_quantity integer default 1)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_item_id uuid;
begin
  if auth.uid() is null or not private.is_family_member(p_family_id) then raise exception 'এই পরিবারের সদস্য ছাড়া পণ্য যোগ করা যাবে না।'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then raise exception 'পণ্যের সঠিক পরিমাণ দিন।'; end if;
  if not exists (select 1 from public.products p where p.id = p_product_id and p.is_active = true) then raise exception 'পণ্যটি বর্তমানে পাওয়া যাচ্ছে না।'; end if;
  insert into public.family_shopping_items(family_id, product_id, quantity, added_by, updated_by)
  values (p_family_id, p_product_id, p_quantity, auth.uid(), auth.uid())
  on conflict (family_id, product_id) where product_id is not null
  do update set quantity = least(10000, public.family_shopping_items.quantity + excluded.quantity), updated_by = auth.uid(), updated_at = now()
  returning id into v_item_id;
  return v_item_id;
end;
$$;

create or replace function public.create_family_order_atomic(
  p_family_id uuid, p_customer_name text, p_phone text, p_delivery_address text,
  p_payment_method text, p_transaction_id text, p_items jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_group public.family_groups%rowtype; v_order_id uuid; v_item record;
  v_product_name text; v_brand text; v_variant text; v_unit_price numeric;
  v_subtotal numeric := 0; v_service_charge numeric; v_delivery_fee numeric; v_minimum numeric;
begin
  if auth.uid() is null or not private.is_family_owner(p_family_id) then raise exception 'শুধু পরিবারের Owner চূড়ান্ত অর্ডার করতে পারবেন।'; end if;
  select * into v_group from public.family_groups where id = p_family_id for update;
  if not found then raise exception 'পরিবারটি পাওয়া যায়নি।'; end if;
  if p_customer_name is null or pg_catalog.btrim(p_customer_name) = '' or p_phone is null or pg_catalog.btrim(p_phone) = '' or p_delivery_address is null or pg_catalog.btrim(p_delivery_address) = '' then raise exception 'নাম, মোবাইল ও ডেলিভারি ঠিকানা পূরণ করুন।'; end if;
  if p_payment_method not in ('cod','bkash','nagad') then raise exception 'পেমেন্ট পদ্ধতি সঠিক নয়।'; end if;
  if p_payment_method in ('bkash','nagad') and pg_catalog.btrim(coalesce(p_transaction_id,'')) = '' then raise exception 'Transaction ID লিখুন।'; end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' or pg_catalog.jsonb_array_length(p_items) = 0 then raise exception 'পরিবারের বাজারের তালিকা খালি।'; end if;
  v_minimum := case v_group.package_id when 'weekly-family' then 1000 when 'budget-smart' then 500 else 2000 end;
  select s.service_charge, s.delivery_fee into v_service_charge, v_delivery_fee from public.app_settings s where s.id = 1 for share;
  if not found or v_service_charge < 0 or v_delivery_fee < 0 then raise exception 'অর্ডারের চার্জ সেটিংস পাওয়া যায়নি।'; end if;
  for v_item in select * from pg_catalog.jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 10000 then raise exception 'পণ্যের তথ্য সঠিক নয়।'; end if;
    select p.name, p.brand, p.variant, p.price into v_product_name, v_brand, v_variant, v_unit_price from public.products p where p.id = v_item.product_id and p.is_active = true for update;
    if not found then raise exception 'একটি পণ্য বর্তমানে পাওয়া যাচ্ছে না।'; end if;
    if v_unit_price is null or v_unit_price <= 0 then raise exception 'পণ্যের মূল্য সঠিক নয়।'; end if;
    if not exists (select 1 from public.products p where p.id = v_item.product_id and p.stock >= v_item.quantity) then raise exception 'পর্যাপ্ত স্টক নেই: %', v_product_name; end if;
    v_subtotal := v_subtotal + v_unit_price * v_item.quantity;
  end loop;
  if v_subtotal < v_minimum then raise exception 'এই প্যাকেজে অর্ডারের জন্য পণ্যমূল্য কমপক্ষে ৳% হতে হবে।', v_minimum; end if;
  insert into public.orders(user_id, family_group_id, customer_name, phone, delivery_address, payment_method, transaction_id, order_status, subtotal, service_charge, delivery_fee, total, payment_status, package_id)
  values (auth.uid(), p_family_id, pg_catalog.btrim(p_customer_name), pg_catalog.btrim(p_phone), pg_catalog.btrim(p_delivery_address), p_payment_method,
    case when p_payment_method in ('bkash','nagad') then pg_catalog.btrim(p_transaction_id) else null end,
    'pending', v_subtotal, v_service_charge, v_delivery_fee, v_subtotal + v_service_charge + v_delivery_fee, 'pending', v_group.package_id)
  returning id into v_order_id;
  for v_item in select * from pg_catalog.jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    select p.name, p.brand, p.variant, p.price into v_product_name, v_brand, v_variant, v_unit_price from public.products p where p.id = v_item.product_id and p.is_active = true;
    update public.products set stock = stock - v_item.quantity where id = v_item.product_id and is_active = true and stock >= v_item.quantity;
    if not found then raise exception 'পর্যাপ্ত স্টক নেই: %', v_product_name; end if;
    insert into public.order_items(order_id, product_id, product_name, quantity, unit_price, line_total, brand, variant)
    values (v_order_id, v_item.product_id, v_product_name, v_item.quantity, v_unit_price, v_unit_price * v_item.quantity, v_brand, v_variant);
  end loop;
  return v_order_id;
end;
$$;

revoke all on function public.create_family_group(text,numeric,text) from public, anon;
revoke all on function public.join_family_group(text) from public, anon;
revoke all on function public.family_add_shopping_item(uuid,uuid,integer) from public, anon;
revoke all on function public.create_family_order_atomic(uuid,text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.create_family_group(text,numeric,text) to authenticated;
grant execute on function public.join_family_group(text) to authenticated;
grant execute on function public.family_add_shopping_item(uuid,uuid,integer) to authenticated;
grant execute on function public.create_family_order_atomic(uuid,text,text,text,text,text,jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_shopping_items') then
    alter publication supabase_realtime add table public.family_shopping_items;
  end if;
end;
$$;
