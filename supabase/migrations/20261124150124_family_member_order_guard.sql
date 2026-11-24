create or replace function private.guard_family_member_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and auth.uid() = new.user_id
     and exists (
       select 1 from public.family_members fm
       where fm.user_id = new.user_id and fm.role = 'member'
     ) then
    raise exception 'আপনি Family Member হিসেবে যুক্ত আছেন। পরিবারের Owner-ই চূড়ান্ত অর্ডার করতে পারবেন।';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_family_member_order() from public, anon, authenticated;

drop trigger if exists guard_family_member_order on public.orders;
create trigger guard_family_member_order
before insert on public.orders
for each row execute function private.guard_family_member_order();
