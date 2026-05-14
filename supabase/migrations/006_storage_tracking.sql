-- ============================================================
-- Migration 006 — storage usage tracking + Stripe webhook note
-- ============================================================

-- Function to increment storage_used_bytes for a user's subscription
create or replace function increment_storage_used(
  p_user_id    uuid,
  p_bytes      bigint
)
returns void language plpgsql security definer as $$
begin
  update storage_subscriptions
  set storage_used_bytes = coalesce(storage_used_bytes, 0) + p_bytes
  where user_id = p_user_id
    and cancelled_at is null
  ;
  -- If no subscription row exists, silently do nothing (free tier tracks nothing)
end $$;

-- Function to decrement storage on deletion
create or replace function decrement_storage_used(
  p_user_id uuid,
  p_bytes   bigint
)
returns void language plpgsql security definer as $$
begin
  update storage_subscriptions
  set storage_used_bytes = greatest(0, coalesce(storage_used_bytes, 0) - p_bytes)
  where user_id = p_user_id
    and cancelled_at is null
  ;
end $$;

-- ── Missing RLS on fee_overrides ────────────────────────────────

-- Allow admins to delete fee overrides
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'fee_overrides' and policyname = 'fee_overrides_admin_delete'
  ) then
    execute 'create policy fee_overrides_admin_delete on fee_overrides for delete using (
      exists (select 1 from profiles where id = auth.uid() and role = ''admin'')
    )';
  end if;
end$$;

-- ── profiles: add missing policy for expert_profiles insert ─────
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'expert_profiles' and policyname = 'experts_insert_own'
  ) then
    execute 'create policy experts_insert_own on expert_profiles for insert with check (auth.uid() = id)';
  end if;
end$$;

-- ── Index for payment method lookups ────────────────────────────
create index if not exists idx_profiles_stripe_customer on profiles(stripe_customer_id)
  where stripe_customer_id is not null;

-- ── Note on Stripe webhook events ───────────────────────────────
-- Ensure these events are enabled in your Stripe webhook:
--   payment_intent.succeeded
--   payment_intent.payment_failed
--   customer.subscription.created   ← add this
--   customer.subscription.updated
--   customer.subscription.deleted
--   account.updated
--   setup_intent.succeeded          ← add this (confirms card saved)
--
-- Webhook URL: https://tightspothelper.com/api/webhooks/stripe
