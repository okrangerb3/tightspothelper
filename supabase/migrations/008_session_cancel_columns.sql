-- Migration 008: Add cancellation metadata to sessions table

alter table sessions
  add column if not exists cancelled_reason text,
  add column if not exists cancelled_at     timestamptz;

-- notes_updated_at was added in migration 004 already;
-- this migration is purely additive for cancellation tracking.
