-- ============================================================
-- Migration 007 — add 'failed' to payment_status enum
-- Fixes: Stripe webhook payment_intent.payment_failed handler
-- sets payment_status = 'failed' which was missing from the enum.
-- ============================================================

alter type payment_status add value if not exists 'failed';
