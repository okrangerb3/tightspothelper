-- ============================================================
-- Migration 005 — storage subscription RLS additions + views
-- ============================================================

-- Allow authenticated users to read categories (needed for booking page)
-- already handled in 004 but ensure correct policy name doesn't conflict
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'categories' and policyname = 'categories_auth_read'
  ) then
    execute 'create policy categories_auth_read on categories for select
             to authenticated using (true)';
  end if;
end$$;

-- Expert profiles: allow customers to search approved experts
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'expert_profiles' and policyname = 'experts_customer_search'
  ) then
    execute 'create policy experts_customer_search on expert_profiles for select
             to authenticated using (status = ''approved'' and available = true)';
  end if;
end$$;

-- Notifications: allow insert from service role (for webhook handlers)
create policy if not exists "notifications_service_insert" on notifications
  for insert with check (true);

-- Reviews: allow authenticated read
create policy if not exists "reviews_public_read" on reviews
  for select using (true);

-- Reviews: allow reviewer to insert
create policy if not exists "reviews_insert" on reviews
  for insert with check (auth.uid() = reviewer_id);

-- Storage subscriptions: allow service role to upsert (for Stripe webhook)
create policy if not exists "storage_subs_service_upsert" on storage_subscriptions
  for all to service_role using (true);

-- Disputes: allow read for participants
create policy if not exists "disputes_participant_read" on disputes
  for select using (
    exists (
      select 1 from sessions s where s.id = session_id
      and (s.customer_id = auth.uid() or s.expert_id = auth.uid())
    )
  );

-- Fee overrides: admin insert/update
create policy if not exists "fee_overrides_admin_write" on fee_overrides
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── Realtime publications ─────────────────────────────────────

-- Enable realtime on notifications table (for notification bell)
alter publication supabase_realtime add table notifications;

-- Enable realtime on session_photos (for live photo sharing)
alter publication supabase_realtime add table session_photos;

-- ── Seed admin note (update with real email before running) ───
-- UPDATE profiles SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-admin@email.com');
