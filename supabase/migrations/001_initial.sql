-- ============================================================
-- TightSpotHelper — Initial Schema
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────

create type user_role as enum ('customer', 'expert', 'admin');
create type session_status as enum ('pending', 'active', 'completed', 'cancelled', 'disputed');
create type expert_status as enum ('pending', 'approved', 'suspended', 'rejected');
create type fee_type as enum ('percentage', 'flat');
create type recording_plan as enum ('free', 'per_session', 'subscription');
create type storage_tier as enum ('basic', 'pro', 'unlimited');
create type payment_status as enum ('pending', 'held', 'released', 'refunded', 'failed');
create type photo_stage as enum ('pre', 'during');

-- ── Profiles ─────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null default 'customer',
  full_name text,
  avatar_url text,
  phone text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Categories ───────────────────────────────────────────────

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  description text,
  icon text,                          -- Tabler icon name
  fee_type fee_type not null default 'percentage',
  fee_value numeric not null,         -- 0.20 for 20%; or JSON stored as text for flat tiers
  fee_flat_tiers jsonb,               -- {"15":4,"30":6,"45":8,"60":10,...} for flat type
  rate_min numeric not null default 25,
  rate_max numeric not null default 300,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed default categories
insert into categories (name, slug, description, icon, fee_type, fee_value, rate_min, rate_max) values
  ('Plumbing',         'plumbing',    'Pipes, drains, fixtures',        'ti-droplet',    'percentage', 0.20, 40, 250),
  ('Electrical',       'electrical',  'Wiring, panels, outlets',         'ti-bolt',       'percentage', 0.22, 50, 300),
  ('HVAC',             'hvac',        'Heating, cooling, ventilation',   'ti-wind',       'percentage', 0.18, 60, 300),
  ('Appliances',       'appliances',  'Washers, dryers, refrigerators',  'ti-tool',       'flat',       0,    35, 200),
  ('Carpentry',        'carpentry',   'Doors, trim, furniture assembly', 'ti-hammer',     'flat',       0,    30, 175),
  ('General handyman', 'handyman',    'Misc repairs and installs',       'ti-screwdriver','percentage', 0.15, 25, 150);

-- Flat fee tiers for applicable categories
update categories set fee_flat_tiers = '{"15":4,"30":6,"45":8,"60":10,"75":12,"90":14,"105":16,"120":18}'::jsonb where slug = 'appliances';
update categories set fee_flat_tiers = '{"15":5,"30":8,"45":10,"60":12,"75":15,"90":18,"105":20,"120":22}'::jsonb where slug = 'carpentry';

-- ── Fee overrides (promo periods) ────────────────────────────

create table fee_overrides (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references categories on delete cascade,
  override_value numeric not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ── Expert profiles ──────────────────────────────────────────

create table expert_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  status expert_status not null default 'pending',
  bio text,
  years_experience int,
  certifications text[],
  stripe_connect_id text unique,
  stripe_connect_onboarded boolean default false,
  checkr_candidate_id text,
  checkr_report_id text,
  background_check_passed boolean,
  hourly_rate numeric,
  category_ids uuid[],
  rating_avg numeric default 0,
  rating_count int default 0,
  session_count int default 0,
  response_time_avg interval,
  available boolean default true,
  rejection_reason text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Sessions ─────────────────────────────────────────────────

create table sessions (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references profiles(id),
  expert_id uuid references profiles(id),
  category_id uuid not null references categories(id),
  status session_status not null default 'pending',

  -- Scheduling
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  duration_billed_minutes int,        -- rounded to next 15-min block

  -- Pricing snapshot (captured at booking time)
  expert_rate numeric not null,       -- expert's hourly rate at time of booking
  platform_fee_type fee_type not null,
  platform_fee_value numeric not null,
  session_subtotal numeric,           -- rate × (minutes/60)
  platform_fee_amount numeric,        -- calculated fee
  customer_total numeric,             -- subtotal + fee (what customer pays)
  expert_payout numeric,              -- subtotal (what expert earns)

  -- Problem description
  problem_title text,
  problem_description text,

  -- Expert notes (filled during/after session)
  notes text,
  parts_needed jsonb,                 -- [{"name":"P-trap","qty":1},...]
  resolution_status text,

  -- Daily.co
  daily_room_name text unique,
  daily_room_url text,

  -- Payment
  payment_status payment_status default 'pending',
  stripe_payment_intent_id text unique,
  stripe_transfer_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Session photos ───────────────────────────────────────────

create table session_photos (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  stage photo_stage not null,
  storage_path text not null,         -- R2 key: sessions/{id}/pre/filename or during/
  file_name text,
  file_size_bytes int,
  mime_type text,
  created_at timestamptz not null default now()
);

-- ── Recordings ───────────────────────────────────────────────

create table recordings (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  r2_key text not null unique,        -- sessions/{id}/recording.mp4
  r2_admin_key text not null unique,  -- sessions/{id}/recording_master.mp4
  duration_seconds int,
  size_bytes bigint,
  plan recording_plan not null default 'free',
  expires_at timestamptz,             -- null = kept forever
  deleted_at timestamptz,             -- soft delete for free tier
  stripe_payment_intent_id text,      -- for per-session purchases
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Storage subscriptions ────────────────────────────────────

create table storage_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  tier storage_tier not null,
  stripe_subscription_id text unique,
  storage_used_bytes bigint default 0,
  storage_limit_bytes bigint not null, -- -1 = unlimited
  started_at timestamptz not null default now(),
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ── Reviews ──────────────────────────────────────────────────

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  reviewee_id uuid not null references profiles(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  flagged boolean default false,
  flagged_reason text,
  moderated_by uuid references profiles(id),
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Disputes ─────────────────────────────────────────────────

create table disputes (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id),
  raised_by uuid not null references profiles(id),
  reason text not null,
  status text not null default 'open',  -- open | resolved | escalated
  resolution text,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Notifications log ────────────────────────────────────────

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,                 -- 'recording_expiry_warning' | 'session_ready' | ...
  payload jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── RLS Policies ─────────────────────────────────────────────

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table session_photos enable row level security;
alter table recordings enable row level security;
alter table reviews enable row level security;
alter table disputes enable row level security;
alter table notifications enable row level security;

-- Profiles: users see own; admins see all
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_admin" on profiles for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Sessions: participants see their own; admins see all
create policy "sessions_participant" on sessions for select using (
  auth.uid() = customer_id or auth.uid() = expert_id
);
create policy "sessions_admin" on sessions for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Photos: session participants only
create policy "photos_participant" on session_photos for select using (
  exists (
    select 1 from sessions s
    where s.id = session_id
    and (s.customer_id = auth.uid() or s.expert_id = auth.uid())
  )
);
create policy "photos_upload" on session_photos for insert with check (
  auth.uid() = uploaded_by
);

-- Recordings: participants can view (not delete); admins full access
create policy "recordings_participant" on recordings for select using (
  exists (
    select 1 from sessions s
    where s.id = session_id
    and (s.customer_id = auth.uid() or s.expert_id = auth.uid())
    and deleted_at is null
  )
);
create policy "recordings_admin" on recordings for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Notifications: own only
create policy "notifications_own" on notifications for select using (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────

create index idx_sessions_customer   on sessions(customer_id);
create index idx_sessions_expert     on sessions(expert_id);
create index idx_sessions_status     on sessions(status);
create index idx_sessions_category   on sessions(category_id);
create index idx_photos_session      on session_photos(session_id);
create index idx_recordings_session  on recordings(session_id);
create index idx_recordings_expires  on recordings(expires_at) where deleted_at is null;
create index idx_reviews_reviewee    on reviews(reviewee_id);
create index idx_notifications_user  on notifications(user_id, read_at);

-- ── Triggers ─────────────────────────────────────────────────

-- Auto-update updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_updated_at   before update on profiles   for each row execute function touch_updated_at();
create trigger trg_sessions_updated_at   before update on sessions   for each row execute function touch_updated_at();
create trigger trg_recordings_updated_at before update on recordings for each row execute function touch_updated_at();
create trigger trg_categories_updated_at before update on categories for each row execute function touch_updated_at();

-- Recalculate expert rating after review
create or replace function update_expert_rating()
returns trigger language plpgsql as $$
begin
  update expert_profiles set
    rating_avg   = (select avg(rating) from reviews where reviewee_id = new.reviewee_id),
    rating_count = (select count(*)    from reviews where reviewee_id = new.reviewee_id)
  where id = new.reviewee_id;
  return new;
end $$;

create trigger trg_update_expert_rating
  after insert or update on reviews
  for each row execute function update_expert_rating();
