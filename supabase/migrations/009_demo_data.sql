-- ============================================================
-- TightSpotHelper — Demo / seed data
-- Run ONLY in development or staging — NOT in production.
--
-- Prerequisites:
--   1. Migrations 001-008 already applied.
--   2. Two test users already created via Auth (email signup).
--      Replace the email addresses below with real test accounts.
--
-- Quick-start: you can create the auth users first in
--   Supabase Dashboard → Authentication → Users → Invite user
--   or via the Supabase anon client from your app's signup page.
--
-- Then paste the UUIDs from auth.users into the variables block.
-- ============================================================

do $$
declare
  -- ─── PASTE YOUR TEST USER UUIDs HERE ───────────────────
  v_customer_id   uuid := '00000000-0000-0000-0000-000000000001'; -- replace
  v_expert_id     uuid := '00000000-0000-0000-0000-000000000002'; -- replace
  v_admin_id      uuid := '00000000-0000-0000-0000-000000000003'; -- replace (optional)
  -- ────────────────────────────────────────────────────────

  v_cat_plumbing   uuid;
  v_cat_electrical uuid;
  v_cat_hvac       uuid;
  v_session1_id    uuid;
  v_session2_id    uuid;
begin

  -- ── Fetch category IDs ───────────────────────────────────
  select id into v_cat_plumbing   from categories where slug = 'plumbing';
  select id into v_cat_electrical from categories where slug = 'electrical';
  select id into v_cat_hvac       from categories where slug = 'hvac';

  -- ── Profiles ─────────────────────────────────────────────
  -- NOTE: the auth trigger (migration 002) already inserts a bare profile row
  -- on signup. We upsert here to add display data.

  insert into profiles (id, role, full_name, phone)
  values
    (v_customer_id, 'customer', 'Jamie Homeowner',  '+15550001111'),
    (v_expert_id,   'expert',   'Alex Plumber',     '+15550002222')
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone     = excluded.phone,
    role      = excluded.role;

  -- Optionally set admin role (only if v_admin_id is a real user)
  -- update profiles set role = 'admin' where id = v_admin_id;

  -- ── Expert profile ────────────────────────────────────────
  insert into expert_profiles (
    id, status, bio, years_experience, certifications,
    hourly_rate, category_ids, available,
    stripe_connect_onboarded, background_check_passed
  )
  values (
    v_expert_id,
    'approved',
    'Licensed master plumber with 12 years of residential & commercial experience. I diagnose leaks, water heater issues, and fixture replacements over video in minutes.',
    12,
    array['Master Plumber License CA-MP-44821', 'EPA 608 Certified'],
    120,
    array[v_cat_plumbing, v_cat_hvac],
    true,
    true,
    true
  )
  on conflict (id) do update set
    status                    = 'approved',
    bio                       = excluded.bio,
    years_experience          = excluded.years_experience,
    certifications            = excluded.certifications,
    hourly_rate               = excluded.hourly_rate,
    category_ids              = excluded.category_ids,
    available                 = true,
    stripe_connect_onboarded  = true,
    background_check_passed   = true;

  -- ── Completed session (with review) ──────────────────────
  v_session1_id := uuid_generate_v4();

  insert into sessions (
    id, customer_id, expert_id, category_id,
    status, payment_status,
    problem_title, problem_description,
    started_at, ended_at,
    duration_seconds, duration_billed_minutes,
    expert_hourly_rate, platform_fee_type, platform_fee_value,
    expert_payout, platform_fee,
    customer_notes, expert_notes
  ) values (
    v_session1_id,
    v_customer_id,
    v_expert_id,
    v_cat_plumbing,
    'completed', 'released',
    'Kitchen sink drain is backing up',
    'Water drains very slowly. Tried Drano twice with no success. Gurgling sounds from nearby bathroom.',
    now() - interval '3 days 2 hours',
    now() - interval '3 days 1 hour',
    3600, 60,
    120, 'percentage', 0.20,
    96, 24,
    'Expert suggested a main line clog — booked local plumber for snake service.',
    'Classic main-line partial blockage. Customer tried chemical but it likely didn''t reach the clog. Recommended hydro-jetting or mechanical snake at the cleanout.'
  );

  -- Customer rates expert 5 stars
  insert into reviews (session_id, reviewer_id, reviewee_id, rating, comment)
  values (
    v_session1_id,
    v_customer_id,
    v_expert_id,
    5,
    'Alex immediately knew the problem. Saved me hours of guesswork. Worth every penny!'
  )
  on conflict do nothing;

  -- Expert rates customer 5 stars
  insert into reviews (session_id, reviewer_id, reviewee_id, rating, comment)
  values (
    v_session1_id,
    v_expert_id,
    v_customer_id,
    5,
    'Great customer — clear description, good photos, followed through on the fix.'
  )
  on conflict do nothing;

  -- ── Pending session (just booked) ─────────────────────────
  v_session2_id := uuid_generate_v4();

  insert into sessions (
    id, customer_id, expert_id, category_id,
    status, payment_status,
    problem_title, problem_description,
    scheduled_at,
    expert_hourly_rate, platform_fee_type, platform_fee_value
  ) values (
    v_session2_id,
    v_customer_id,
    v_expert_id,
    v_cat_electrical,
    'pending', 'pending',
    'Breaker keeps tripping on kitchen circuit',
    'The 20A breaker for my kitchen outlets trips every few days. No new appliances added. Would like to understand if it''s the breaker itself or something else.',
    now() + interval '2 hours',
    150, 'percentage', 0.22
  );

  -- ── Update expert rating cache (trigger handles inserts, but demo ↑ bypasses it) ──
  update expert_profiles
  set
    rating_avg   = 5.0,
    rating_count = 1,
    session_count = 1
  where id = v_expert_id;

  raise notice 'Demo data inserted successfully.';
  raise notice '  Customer ID : %', v_customer_id;
  raise notice '  Expert ID   : %', v_expert_id;
  raise notice '  Session 1   : % (completed)', v_session1_id;
  raise notice '  Session 2   : % (pending)',   v_session2_id;

end $$;
