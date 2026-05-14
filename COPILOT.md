# TightSpotHelper — GitHub Copilot Review Guide

This file is intended for GitHub Copilot (or any AI assistant) to review the codebase for completeness, correctness, and consistency. Work through each section in order. Flag any issues found as inline comments or in a summary at the end.

---

## 1. Environment Variables Audit

Verify every `process.env.*` reference in the codebase has a corresponding entry in `.env.example`.

Run this to find all env references:
```bash
grep -rh 'process\.env\.' --include='*.ts' --include='*.tsx' . \
  | grep -oP 'process\.env\.\K[A-Z_]+' | sort -u
```

**Expected variables in `.env.example`:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server only, never expose)
- `STRIPE_SECRET_KEY` — Stripe secret key (server only)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (client-safe)
- `STRIPE_PRICE_STORAGE_BASIC` — Stripe price ID for Basic storage plan
- `STRIPE_PRICE_STORAGE_PRO` — Stripe price ID for Pro storage plan
- `STRIPE_PRICE_STORAGE_UNLIMITED` — Stripe price ID for Unlimited storage plan
- `DAILY_API_KEY` — Daily.co API key
- `DAILY_WEBHOOK_SECRET` — Daily.co webhook signing secret
- `R2_ACCOUNT_ID` — Cloudflare account ID
- `R2_ACCESS_KEY_ID` — R2 API token access key
- `R2_SECRET_ACCESS_KEY` — R2 API token secret
- `R2_BUCKET_NAME` — R2 bucket name (tightspothelper-recordings)
- `R2_PUBLIC_URL` — Optional public URL if bucket has public access enabled
- `RESEND_API_KEY` — Resend API key
- `RESEND_FROM_EMAIL` — Verified sender email address
- `CHECKR_API_KEY` — Checkr API key for background checks
- `CHECKR_WEBHOOK_SECRET` — Checkr webhook signing secret
- `NEXT_PUBLIC_APP_URL` — Full app URL (https://tightspothelper.com)
- `CRON_SECRET` — Random secret for Railway cron job authentication
- `NODE_ENV` — production | development

**Copilot: check each one is present in `.env.example` and used correctly (NEXT_PUBLIC_ prefix only on client-safe vars).**

---

## 2. Database Schema Completeness

### Migration order (must run in sequence):
1. `supabase/migrations/001_initial.sql` — all tables, enums, RLS seed, indexes, triggers
2. `supabase/migrations/002_auth_trigger.sql` — auto-create profile on signup
3. `supabase/migrations/003_rpc_functions.sql` — `increment_expert_sessions`, `extend_recording`
4. `supabase/migrations/004_rls_and_indexes.sql` — RLS policies, additional indexes, admin seed note

### Tables checklist — verify each exists in migration 001:
- [ ] `profiles` — id (FK auth.users), role, full_name, avatar_url, phone, stripe_customer_id
- [ ] `categories` — id, name, slug, fee_type, fee_value, fee_flat_tiers, rate_min, rate_max, active, sort_order
- [ ] `fee_overrides` — id, category_id (FK), override_value, starts_at, ends_at, created_by
- [ ] `expert_profiles` — id (FK profiles), status, bio, years_experience, certifications, stripe_connect_id, stripe_connect_onboarded, checkr_*, hourly_rate, category_ids, rating_avg, rating_count, session_count, available
- [ ] `sessions` — id, customer_id, expert_id, category_id, status, scheduled_at, started_at, ended_at, duration_seconds, duration_billed_minutes, expert_rate, platform_fee_type, platform_fee_value, session_subtotal, platform_fee_amount, customer_total, expert_payout, problem_title, problem_description, notes, parts_needed, resolution_status, daily_room_name, daily_room_url, payment_status, stripe_payment_intent_id, stripe_transfer_id
- [ ] `session_photos` — id, session_id, uploaded_by, stage (pre|during), storage_path, file_name, file_size_bytes, mime_type
- [ ] `recordings` — id, session_id, r2_key, r2_admin_key, duration_seconds, size_bytes, plan (free|per_session|subscription), expires_at, deleted_at, stripe_payment_intent_id
- [ ] `storage_subscriptions` — id, user_id, tier, stripe_subscription_id, storage_used_bytes, storage_limit_bytes, started_at, cancelled_at
- [ ] `reviews` — id, session_id, reviewer_id, reviewee_id, rating (1-5), comment, flagged, moderated_by
- [ ] `disputes` — id, session_id, raised_by, reason, status, resolution, resolved_by
- [ ] `notifications` — id, user_id, type, payload, sent_at, read_at

### RLS checklist — verify every table has RLS enabled and appropriate policies:
- [ ] `profiles` — own read/update; admin all
- [ ] `categories` — active public read; admin all
- [ ] `expert_profiles` — approved public read; own all; admin all
- [ ] `sessions` — participant select; admin all
- [ ] `session_photos` — participant select; uploader insert
- [ ] `recordings` — participant select (non-deleted); admin all
- [ ] `storage_subscriptions` — own select; admin all
- [ ] `reviews` — public select; reviewer insert; admin all
- [ ] `disputes` — participant insert; admin all
- [ ] `notifications` — own select/update

### Triggers:
- [ ] `on_auth_user_created` — auto-creates profile + expert_profile shell on signup
- [ ] `touch_updated_at` — applied to profiles, sessions, recordings, categories
- [ ] `update_expert_rating` — recalculates rating_avg and rating_count on review insert/update

### RPC functions:
- [ ] `increment_expert_sessions(expert_id uuid)` — increments session_count
- [ ] `extend_recording(rec_id uuid)` — adds 30 days to expires_at

---

## 3. API Route Completeness

### Authentication — all must verify `supabase.auth.getUser()` before any data access:
- [ ] `POST /api/sessions` — create session, calculate fee, create Daily room, create Stripe PaymentIntent
- [ ] `GET  /api/sessions` — list sessions for current user (customer or expert)
- [ ] `PATCH /api/sessions/[id]` — update notes/parts (expert only)
- [ ] `POST /api/sessions/[id]/token` — get Daily.co meeting token, activates session
- [ ] `POST /api/sessions/[id]/end` — capture Stripe payment, save notes, increment expert count
- [ ] `POST /api/sessions/[id]/review` — submit review (customer only, session must be completed)
- [ ] `GET  /api/categories` — public list of active categories (no auth needed)
- [ ] `POST /api/photos/upload-url` — presigned R2 upload URL (participant only)
- [ ] `GET  /api/photos/[id]/url` — signed R2 download URL (participant or admin)
- [ ] `GET  /api/recordings/[id]/url` — signed R2 URL for recording (participant or admin)
- [ ] `POST /api/recordings/[id]/purchase` — one-time recording purchase via Stripe
- [ ] `POST /api/recordings/[id]/extend` — admin only: extend expiry 30 days
- [ ] `PATCH /api/admin/pros/[id]` — admin approve/reject/suspend expert
- [ ] `PATCH /api/admin/categories/[id]` — admin update category fee rules
- [ ] `POST /api/admin/sessions/[id]/refund` — admin issue full or partial refund
- [ ] `POST /api/webhooks/daily` — handle recording.ready, meeting.ended
- [ ] `POST /api/webhooks/stripe` — handle payment events, subscriptions, Connect
- [ ] `POST /api/cron/expire-recordings` — delete expired free recordings from R2 (CRON_SECRET auth)
- [ ] `POST /api/cron/recording-upsell` — send Day-25 expiry emails (CRON_SECRET auth)
- [ ] `GET  /api/health` — Railway health check (no auth)

### Webhook security:
- [ ] Daily.co webhook verifies `x-daily-signature` HMAC with `DAILY_WEBHOOK_SECRET`
- [ ] Stripe webhook uses `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`
- [ ] Cron routes check `Authorization: Bearer $CRON_SECRET` header
- [ ] Webhook routes are excluded from Next.js middleware auth guard (check `middleware.ts` matcher)

---

## 4. Page Route Completeness

### Public routes (no auth):
- [ ] `/` — landing page (redirects logged-in users to their dashboard)
- [ ] `/login` — email + Google + Apple sign-in
- [ ] `/signup` — two-step: role picker → account details
- [ ] `/auth/callback` — OAuth return handler

### Customer routes (`/customer/*`, auth required, role=customer):
- [ ] `/customer/dashboard` — stats, active session alert, recent sessions
- [ ] `/customer/book` — 4-step booking: category → describe+expert+duration → photos → confirm
- [ ] `/customer/sessions` — full session history with recording badges
- [ ] `/customer/sessions/[id]` — live session room (video + photos + chat)
- [ ] `/customer/sessions/[id]/summary` — post-session: notes, parts, photos, payment, review form, recording CTA
- [ ] `/customer/sessions/[id]/recording` — video playback + keep/purchase CTA

### Expert routes (`/expert/*`, auth required, role=expert):
- [ ] `/expert/dashboard` — earnings, sessions, pending/rejected state gates
- [ ] `/expert/apply` — 5-step application: intro → details → categories → rate → submit
- [ ] `/expert/apply/connect` — creates Stripe Connect account, redirects to Stripe onboarding
- [ ] `/expert/apply/connect/complete` — handles Stripe return, marks onboarded
- [ ] `/expert/sessions` — session history with payouts
- [ ] `/expert/sessions/[id]` — live session room (expert view: video + photos + chat + notes + parts)
- [ ] `/expert/profile` — edit bio, rate, availability, certifications
- [ ] `/expert/earnings` — payout breakdown, monthly summary, Stripe Connect CTA

### Admin routes (`/admin/*`, auth required, role=admin):
- [ ] `/admin/dashboard` — revenue metrics, pending applications alert, recent sessions, expiring recordings
- [ ] `/admin/categories` — inline fee type/value editor with live preview
- [ ] `/admin/pros` — filterable expert list (all/pending/approved/rejected/suspended) with approve/reject/suspend
- [ ] `/admin/sessions` — full session list with status filter tabs
- [ ] `/admin/sessions/[id]` — session detail: all data, photos, recording, reviews, dispute + refund controls
- [ ] `/admin/recordings` — storage overview (total/free/paid GB, R2 cost), per-recording actions

### Error/utility pages:
- [ ] `app/not-found.tsx` — 404 page
- [ ] `app/error.tsx` — global error boundary

---

## 5. Component Completeness

### `components/ui/Shell.tsx`
- [ ] `Sidebar` — nav items per role, active state highlight, sign-out
- [ ] `StatCard` — metric display with optional accent color
- [ ] `PageShell` — wraps sidebar + main content

### `components/session/VideoCall.tsx`
- [ ] Creates Daily.co iframe via `DailyIframe.createFrame()`
- [ ] Joins with `call.join({ url, token })`
- [ ] Shows live timer, REC indicator
- [ ] Expert auto-starts cloud recording on join
- [ ] End session button calls `onSessionEnd(durationSeconds)`
- [ ] Handles `joined-meeting`, `left-meeting`, `error` events
- [ ] Cleans up on unmount

### `components/session/PhotoPanel.tsx`
- [ ] Loads existing photos for session on mount
- [ ] Subscribes to Supabase Realtime for live photo updates (during stage only)
- [ ] Uploads via presigned R2 URL (`/api/photos/upload-url`)
- [ ] Creates DB record in `session_photos` after upload
- [ ] Shows stage badges (pre/live)
- [ ] Full-screen lightbox on tap
- [ ] `capture="environment"` on file input for mobile camera

### `components/session/ChatPanel.tsx`
- [ ] Uses Supabase Realtime broadcast channel (not DB table) for chat
- [ ] Send on Enter (not Shift+Enter)
- [ ] Auto-scrolls to latest message
- [ ] Own messages right-aligned, other messages left-aligned

---

## 6. Third-Party Integration Checklist

### Supabase
- [ ] `lib/supabase/client.ts` — browser client (`createBrowserClient`)
- [ ] `lib/supabase/server.ts` — server client + admin client (`createServerClient`, `createAdminClient`)
- [ ] Auth callback at `/auth/callback/route.ts` handles OAuth code exchange
- [ ] Middleware at `middleware.ts` refreshes session on every request
- [ ] `middleware.ts` matcher excludes `_next`, `api/webhooks`, `api/health`
- [ ] Types at `lib/supabase/types.ts` (generated by `npm run db:types`)

### Daily.co
- [ ] `lib/daily/index.ts` — `createRoom`, `createMeetingToken`, `startRecording`, `deleteRoom`, `verifyDailyWebhook`
- [ ] Room created with `enable_recording: 'cloud'`
- [ ] Token `is_owner: true` for experts (can end session for all)
- [ ] Webhook configured in Daily.co dashboard for: `recording.ready-to-download`, `meeting.ended`
- [ ] Webhook endpoint: `https://tightspothelper.com/api/webhooks/daily`

### Stripe
- [ ] `lib/stripe/index.ts` — pricing calc, PaymentIntent (manual capture), Connect, subscriptions
- [ ] `capture_method: 'manual'` — funds held at booking, captured on session end
- [ ] Expert payout via `transfer_data.destination` on PaymentIntent
- [ ] Storage subscription prices created via `scripts/create-stripe-prices.js`
- [ ] Webhook configured for: `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `account.updated`
- [ ] Connect onboarding at `/expert/apply/connect` → Stripe → `/expert/apply/connect/complete`

### Cloudflare R2
- [ ] `lib/r2/index.ts` — `getUploadUrl`, `getDownloadUrl`, `deleteObject`, `storeRecordingFromUrl`, `recordingPrice`, `STORAGE_LIMITS`
- [ ] Uses AWS SDK S3 client pointed at R2 endpoint
- [ ] Bucket CORS allows `PUT` from app domain
- [ ] Admin master copy (`r2_admin_key`) never touched by expiry cron
- [ ] Presigned URLs used for all client access (bucket not public)

### Resend
- [ ] `lib/resend/index.ts` — all email templates
- [ ] `sendSessionConfirmation` — called from `POST /api/sessions` after booking
- [ ] `sendExpertNewBooking` — called from `POST /api/sessions` after booking
- [ ] `sendApplicationResult` — called from `PATCH /api/admin/pros/[id]`
- [ ] `sendSessionSummary` — called from `POST /api/sessions/[id]/end`
- [ ] `sendRecordingExpiry` — called from `POST /api/cron/recording-upsell`

**Copilot: verify each email send is actually called from the correct API route. Flag any templates defined in `lib/resend/index.ts` that are never imported.**

### Railway
- [ ] `railway.toml` has `healthcheckPath = "/api/health"`
- [ ] Two cron jobs: `expire-recordings` (3am UTC daily) and `recording-upsell` (9am UTC daily)
- [ ] Both cron commands use `$CRON_SECRET` in Authorization header

---

## 7. Security Checklist

- [ ] No `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` in any `NEXT_PUBLIC_*` variable
- [ ] All server-only secrets accessed only in `lib/supabase/server.ts`, API routes, or server components
- [ ] Admin client (`createAdminClient`) only used in server-side API routes, never passed to client
- [ ] All API routes check `supabase.auth.getUser()` (not `getSession()` — sessions can be spoofed)
- [ ] Webhook routes verify signatures before processing
- [ ] Cron routes verify `CRON_SECRET` bearer token
- [ ] R2 objects never publicly accessible — always via signed URLs
- [ ] `session_photos` insert policy checks `uploaded_by = auth.uid()`
- [ ] Admin actions verify `profile.role === 'admin'` via DB lookup, not JWT claim

---

## 8. Data Flow Verification

**Booking flow:**
1. Customer selects category → `GET /api/categories` ✓
2. Customer selects expert → Supabase query in `app/(customer)/book/page.tsx` ✓
3. Pricing calculated client-side (preview) and server-side (authoritative) in `POST /api/sessions` ✓
4. Daily.co room created in `POST /api/sessions` ✓
5. Stripe PaymentIntent created with `capture_method: manual` ✓
6. Photos uploaded: presigned URL → R2 → `session_photos` record ✓
7. Both parties emailed via Resend ← **Copilot: verify email calls are in `POST /api/sessions`**

**Session flow:**
1. Both parties get Daily token from `POST /api/sessions/[id]/token` ✓
2. Session status set to `active` on first token request ✓
3. Expert starts recording — Daily.co cloud recording ✓
4. Photos shared via R2 presigned upload → Supabase Realtime broadcast ✓
5. Chat via Supabase Realtime broadcast channel ✓
6. Session ended → `POST /api/sessions/[id]/end` → Stripe capture → DB update ✓
7. Daily.co fires `meeting.ended` webhook → updates session duration ✓

**Recording flow:**
1. Daily.co fires `recording.ready-to-download` webhook ✓
2. API downloads from Daily → uploads to R2 (user key + admin key) ✓
3. `recordings` row created with `plan=free`, `expires_at=now+30d` ✓
4. Both parties notified via `notifications` table ← **Copilot: verify email also sent here**
5. Day 25: cron job sends upsell email via `lib/resend` ✓
6. Day 30: cron deletes from R2, sets `deleted_at` (admin copy untouched) ✓

**Fee flow:**
1. `calculateSessionPricing()` in `lib/stripe/index.ts` computes subtotal + fee ✓
2. Fee lookup respects active `fee_overrides` with date range ✓
3. Customer sees total only; expert sees full breakdown ✓
4. Fee values snapshotted on session row at booking time ✓

---

## 9. Missing Items to Implement (Known TODOs)

These are intentional stubs or items flagged in code comments:

- [ ] **Checkr integration** — `CHECKR_API_KEY` defined but no `lib/checkr/` helper exists. Need: `POST /api/admin/pros/[id]/background-check` that calls Checkr API to initiate check, and a `POST /api/webhooks/checkr` to handle results and auto-update `background_check_passed`
- [ ] **Stripe customer creation** — `stripe_customer_id` stored in `profiles` but no route creates it. Add to `POST /api/sessions` before creating PaymentIntent: check if customer has `stripe_customer_id`, create Stripe Customer if not, save back to DB
- [ ] **Email calls in booking route** — `sendSessionConfirmation` and `sendExpertNewBooking` are defined but need to be imported and called in `app/api/sessions/route.ts` after session insert
- [ ] **Email call after session end** — `sendSessionSummary` needs to be called in `app/api/sessions/[id]/end/route.ts`
- [ ] **Email call after application decision** — `sendApplicationResult` needs to be called in `app/api/admin/pros/[id]/route.ts`
- [ ] **Checkr webhook handler** — `POST /api/webhooks/checkr` to handle `report.completed` events
- [ ] **Expert categories display** — `expert_profiles.category_ids` is a UUID array but `app/(customer)/book/page.tsx` filters experts by it; ensure Supabase query using `.contains()` works correctly with your Postgres array column
- [ ] **Session review form** — `app/(customer)/sessions/[id]/summary/page.tsx` uses a plain HTML form POST; convert to client component with `fetch()` for better UX
- [ ] **Stripe customer portal** — no route exists for customers to manage storage subscriptions. Add `/api/stripe/portal` that creates a Stripe Customer Portal session
- [ ] **Admin first user** — uncomment and update the `UPDATE profiles SET role = 'admin'` query at the bottom of migration 004 with your actual admin email before running in production

---

## 10. Quick Verification Commands

Run these after setup to verify the app is wired correctly:

```bash
# TypeScript — no type errors
npx tsc --noEmit

# Lint
npm run lint

# Find any unreachable imports
grep -rn "from '@/lib/resend'" app/api/ | head -20

# Verify all API routes export correct HTTP methods
grep -rn "^export async function" app/api/ | grep -v "GET\|POST\|PATCH\|DELETE\|PUT"

# Check no secrets leaked to client
grep -rn "SUPABASE_SERVICE_ROLE_KEY\|STRIPE_SECRET_KEY\|DAILY_API_KEY" app/ \
  --include="*.tsx" --include="*.ts" \
  | grep -v "api/" | grep -v "lib/"

# Confirm all Supabase tables referenced in code exist in migrations
grep -roh "from('\([a-z_]*\)')" app/ lib/ --include="*.ts" | sort -u
```

---

## Copilot Summary Instructions

After reviewing, output a summary in this format:

```
## Review Complete

### ✓ Verified
- [list items confirmed correct]

### ⚠ Issues Found
- [file:line] Description of issue

### 🔲 TODOs Remaining
- [list items from Section 9 that still need implementation]

### Recommended Next Steps
1. [priority order]
```
