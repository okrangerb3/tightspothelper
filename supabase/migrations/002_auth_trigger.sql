-- ============================================================
-- Auto-create profile row when a new auth user signs up
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, avatar_url)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- If signing up as expert, create a pending expert_profile shell
  if coalesce(new.raw_user_meta_data->>'role', 'customer') = 'expert' then
    insert into public.expert_profiles (id, status)
    values (new.id, 'pending')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- Drop and recreate to ensure idempotency
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
