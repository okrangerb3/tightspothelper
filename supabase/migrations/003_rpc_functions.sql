-- ============================================================
-- Helper functions for RPC calls
-- ============================================================

-- Called from session end API to increment expert session count
create or replace function increment_expert_sessions(expert_id uuid)
returns void language plpgsql security definer as $$
begin
  update expert_profiles set session_count = coalesce(session_count, 0) + 1
  where id = expert_id;
end $$;

-- Admin: extend a recording's expiry by 30 days
create or replace function extend_recording(rec_id uuid)
returns void language plpgsql security definer as $$
begin
  update recordings
  set expires_at = coalesce(expires_at, now()) + interval '30 days'
  where id = rec_id and deleted_at is null;
end $$;
