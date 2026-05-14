-- ============================================================
-- Migration 004 — email access view, indexes, storage defaults
-- ============================================================

-- Expose auth.users.email safely for admin queries (RLS still applies)
create or replace view user_emails as
  select id, email from auth.users;

-- Grant service role access only
revoke all on user_emails from anon, authenticated;
grant select on user_emails to service_role;

-- Sessions admin dispute handling
alter table sessions add column if not exists notes_updated_at timestamptz;

-- Disputes RLS for admin only
alter table disputes enable row level security;
create policy "disputes_admin" on disputes for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Allow participants to insert disputes
create policy "disputes_participant_insert" on disputes for insert with check (
  exists (
    select 1 from sessions s where s.id = session_id
    and (s.customer_id = auth.uid() or s.expert_id = auth.uid())
  )
);

-- Storage subscriptions RLS
alter table storage_subscriptions enable row level security;
create policy "storage_subs_own"   on storage_subscriptions for select using (auth.uid() = user_id);
create policy "storage_subs_admin" on storage_subscriptions for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Fee overrides RLS (admin only)
alter table fee_overrides enable row level security;
create policy "fee_overrides_admin" on fee_overrides for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "fee_overrides_read" on fee_overrides for select using (true);

-- Categories public read
alter table categories enable row level security;
create policy "categories_public_read" on categories for select using (active = true);
create policy "categories_admin"       on categories for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Expert profiles: public approved read, private full read
alter table expert_profiles enable row level security;
create policy "experts_public_read" on expert_profiles for select using (status = 'approved');
create policy "experts_own"         on expert_profiles for all using (auth.uid() = id);
create policy "experts_admin"       on expert_profiles for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Additional performance indexes
create index if not exists idx_sessions_daily_room   on sessions(daily_room_name);
create index if not exists idx_recordings_plan       on recordings(plan) where deleted_at is null;
create index if not exists idx_expert_available      on expert_profiles(available, status);
create index if not exists idx_disputes_session      on disputes(session_id);
create index if not exists idx_storage_subs_user     on storage_subscriptions(user_id);

-- Seed first admin user (update email before running)
-- UPDATE profiles SET role = 'admin' WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'your-admin@email.com'
-- );
