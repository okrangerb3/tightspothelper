# TightSpotHelper — Copilot Notes

Reference for reviewers and AI assistants working on this repo. Keep this in sync with the actual stack.

---

## 1. Stack Overview

| Concern                  | Choice                                  |
|--------------------------|------------------------------------------|
| Framework                | Next.js 14 App Router                    |
| Auth                     | Better Auth (`@better-auth/*`)           |
| DB / ORM                 | Postgres + Prisma                        |
| Realtime                 | Socket.IO (custom `server.ts`)           |
| Video calls              | Jitsi (self-hosted) — JWT-authed rooms   |
| Recording                | Jibri → POSTs to `/api/webhooks/jibri`   |
| Payments                 | Stripe + Stripe Connect (Express)        |
| Background checks        | Checkr (REST) + webhook                  |
| Email                    | Resend                                   |
| Object storage           | Cloudflare R2 (S3-compatible)            |
| Deploy                   | Railway                                  |

> **Earlier drafts of this doc and one of the READMEs referenced Supabase + Daily.co.** That stack was replaced — anything you see citing `lib/supabase` or `lib/daily` is stale. The runtime is Prisma + Jitsi + Socket.IO.

---

## 2. Page Route Completeness

### Public routes (no auth)
- [x] `/` — landing page (redirects logged-in users to their dashboard)
- [x] `/login` — email + Google + Apple sign-in
- [x] `/signup` — two-step: role picker → account details
- [x] `/auth/callback` — OAuth return handler

### Customer routes (`/customer/*`)
- [x] `/customer/dashboard`
- [x] `/customer/book` — 4-step: category → describe + expert + duration → photos → confirm
- [x] `/customer/sessions`
- [x] `/customer/sessions/[id]` — live room
- [x] `/customer/sessions/[id]/summary` — `ReviewForm` is a client component
- [x] `/customer/sessions/[id]/recording`

### Expert routes (`/expert/*`)
- [x] `/expert/dashboard`
- [x] `/apply` — 5-step application
- [x] `/apply/connect`, `/apply/connect/refresh`, `/apply/connect/complete`
- [x] `/expert/sessions`, `/expert/sessions/[id]`, `/expert/sessions/[id]/summary`
- [x] `/expert/profile`, `/expert/earnings`

### Admin routes (`/admin/*`)
- [x] `/admin/dashboard`
- [x] `/admin/categories`
- [x] `/admin/pros` (filters: all / pending / approved / rejected / suspended)
- [x] `/admin/sessions`, `/admin/sessions/[id]` (DisputeControls + ReviewModerationActions)
- [x] `/admin/recordings` (admin downloads via `/api/recordings/[id]/url` — returns `r2KeyBackup` when caller is admin)

---

## 3. API Route Completeness

All routes use `requireAuth()` / `requireRole()` from `lib/api-helpers.ts` (Better Auth session).

### Sessions
- [x] `POST /api/sessions` — create session, ensure Stripe customer, charge held, emails both parties
- [x] `GET  /api/sessions` — list sessions for current user
- [x] `PATCH /api/sessions/[id]` — update notes/parts (expert only)
- [x] `POST /api/sessions/[id]/token` — activate session, return Jitsi room name
- [x] `POST /api/sessions/[id]/end` — capture Stripe payment, save notes, increment session count, email summary
- [x] `POST /api/sessions/[id]/review` — submit review

### Categories / experts
- [x] `GET  /api/categories` — public list of active categories
- [x] `GET  /api/experts` — filters by `status: 'approved'`, `available: true`, `stripeConnectOnboarded: true`

### Photos / recordings
- [x] `POST /api/photos/upload-url`
- [x] `GET  /api/photos/[id]/url`
- [x] `GET  /api/recordings/[id]/url` — admins receive backup key, participants receive user key
- [x] `POST /api/recordings/[id]/purchase`
- [x] `POST /api/recordings/[id]/extend`

### Admin
- [x] `PATCH  /api/admin/pros/[id]` — approve/reject/suspend; auto-fires Checkr on approve
- [x] `POST   /api/admin/pros/[id]/background-check` — manual re-run
- [x] `PATCH  /api/admin/categories/[id]`
- [x] `POST   /api/admin/sessions/[id]/refund`
- [x] `POST   /api/admin/sessions/[id]/cancel`
- [x] `PATCH  /api/admin/sessions/[id]/dispute`
- [x] `PATCH  /api/admin/reviews/[id]` — flag/unflag
- [x] `DELETE /api/admin/reviews/[id]` — remove

### Payments
- [x] `POST /api/payments/setup-intent` — save card
- [x] `GET  /api/payments/methods` — list saved cards
- [x] `POST /api/stripe/portal` — Stripe Customer Portal session (added in this round of fixes)

### Webhooks
- [x] `POST /api/webhooks/jibri` — recording finished
- [x] `POST /api/webhooks/stripe` — payment events + Connect updates
- [x] `POST /api/webhooks/checkr` — BG-check report state changes (added in this round of fixes)

### Cron
- [x] `POST /api/cron/expire-recordings`
- [x] `POST /api/cron/recording-upsell`
- [x] `GET  /api/health`

### Webhook & cron security
- Stripe webhook → `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`
- Jibri webhook → HMAC verify with `JIBRI_WEBHOOK_SECRET`
- Checkr webhook → HMAC-SHA256 verify with `CHECKR_WEBHOOK_SECRET` (accepts `X-Checkr-Signature` in either `<hex>` or `sha256=<hex>` form)
- Cron routes check `Authorization: Bearer $CRON_SECRET`
- `middleware.ts` matcher is `['/customer/:path*', '/expert/:path*', '/admin/:path*']` — `/api/*` is not gated by middleware, so webhooks pass through; each route enforces its own auth or signature check

---

## 4. Library Modules

| Module               | Purpose                                                   |
|----------------------|------------------------------------------------------------|
| `lib/db.ts`          | Prisma singleton                                           |
| `lib/auth.ts`        | Better Auth server config                                  |
| `lib/auth-client.ts` | Better Auth browser client                                 |
| `lib/api-helpers.ts` | `requireAuth`, `requireRole`                               |
| `lib/jitsi/`         | Room name derivation, JWT minting                          |
| `lib/jibri/`         | REST client for Jibri start/stop API                       |
| `lib/stripe/`        | Pricing calc, PaymentIntents, Connect, Customer Portal     |
| `lib/r2/`            | Presigned URLs, upload/download, recording key helpers     |
| `lib/resend/`        | All email templates                                        |
| `lib/checkr/`        | Candidate + invitation + report + webhook verify           |

---

## 5. Email Send Sites

Every Resend template must be called from exactly one well-defined site:

| Template                      | Called from                                       |
|-------------------------------|---------------------------------------------------|
| `sendSessionConfirmation`     | `POST /api/sessions` (to customer)                |
| `sendExpertNewBooking`        | `POST /api/sessions` (to expert) ✓ fixed          |
| `sendApplicationResult`       | `PATCH /api/admin/pros/[id]`                      |
| `sendSessionSummary`          | `POST /api/sessions/[id]/end`                     |
| `sendRecordingExpiry`         | `POST /api/cron/recording-upsell`                 |

---

## 6. Data Flow Verification

### Booking
1. `GET /api/categories` → 2. `GET /api/experts?categoryId=` (filtered to `available && stripeConnectOnboarded`)
3. `POST /api/sessions` validates expert + connect onboarding, ensures Stripe customer, calculates fee server-side, creates PaymentIntent with `capture_method: 'manual'` and `transfer_data.destination = expert.stripeConnectId`
4. Photos PUT to R2 via presigned URLs
5. Both parties emailed (customer confirmation + expert new-booking) ✓

### Session
1. `POST /api/sessions/[id]/token` flips status to `active`, returns Jitsi room name `tsh-<sessionId>`
2. Expert (owner via JWT) starts recording — Jibri begins capturing
3. Chat + photos broadcast via Socket.IO `session:<id>` room
4. `POST /api/sessions/[id]/end` captures payment, persists notes/parts, increments expert session count, emails summary

### Recording
1. Jibri finishes encoding → POSTs `/api/webhooks/jibri`
2. Handler downloads to R2 — original key + admin backup key (`keys.recording` + `keys.recordingAdmin`)
3. `recordings` row: `purchaseStatus = free_window`, `expiresAt = now + 30d`
4. Day-25 cron: `sendRecordingExpiry` email
5. Day-30 cron: deletes original R2 object, marks `purchaseStatus = expired`. Admin backup is never touched.

### Background check
1. Admin clicks Approve in `/admin/pros` → `PATCH /api/admin/pros/[id]` sets `status = 'approved'`, sets `authUser.role = 'expert'`, calls `initiateBackgroundCheck()` in the background, sends `sendApplicationResult` email
2. `lib/checkr` creates Candidate → Invitation (or Report fallback), persists `checkrCandidateId` + `checkrReportId`
3. Applicant completes the Checkr-hosted form
4. Checkr POSTs `/api/webhooks/checkr` on every state change
5. Handler verifies HMAC, refetches the report, updates `backgroundCheckPassed`; if a previously approved expert comes back `consider`, the expert is auto-suspended

---

## 7. Security Checklist

- [x] No server secrets in any `NEXT_PUBLIC_*` env var
- [x] All API routes verify session via `requireAuth()` / `requireRole()`
- [x] Webhook routes verify signatures before doing any DB work
- [x] Cron routes verify `CRON_SECRET` bearer token
- [x] R2 objects are private — access only via signed URLs
- [x] Admin status checked via DB role lookup (Better Auth user record), not from a client claim
- [x] Booking-time guard prevents non-onboarded experts from being matched (`GET /api/experts` filters them out, and `POST /api/sessions` re-checks server-side)

---

## 8. Resolved TODOs (this iteration)

All of these were on the previous TODO list and are now done:

- [x] `lib/checkr/index.ts` — full Checkr SDK wrapper (candidate, invitation, report, signature verify, status mapping)
- [x] `POST /api/webhooks/checkr` — verifies signature, refetches report, updates `backgroundCheckPassed`, auto-suspends on failure
- [x] `POST /api/sessions` — already creates Stripe customer; **now also calls `sendExpertNewBooking` and uses the expert's actual name in the customer-side confirmation** (previously the customer's name was being used as the expert's name)
- [x] `POST /api/sessions/[id]/end` — calls `sendSessionSummary`
- [x] `PATCH /api/admin/pros/[id]` — calls `sendApplicationResult`
- [x] `POST /api/stripe/portal` — Stripe Customer Portal session for managing saved cards
- [x] Review form — already a client component on both customer and expert sides
- [x] Admin master copy access — already wired into `GET /api/recordings/[id]/url` (returns `r2KeyBackup` when caller is admin)

### Still outstanding
- [ ] **Admin first user** — uncomment and update the `UPDATE auth_user SET role = 'admin'` block in the initial Prisma seed (or run a one-off SQL) before going to production
- [ ] If you want to gate **session-taking** on `backgroundCheckPassed = true` (not just admin approval), add `backgroundCheckPassed: true` to the `where` in `GET /api/experts` and the precondition in `POST /api/sessions`. Currently approval alone is the gate.

---

## 9. Quick Verification Commands

```bash
# TypeScript — no type errors
npx tsc --noEmit

# Lint
npm run lint

# Check every Resend template is actually imported somewhere
for f in sendSessionConfirmation sendExpertNewBooking sendApplicationResult sendSessionSummary sendRecordingExpiry; do
  echo "$f:"; grep -rn "$f" app/ --include="*.ts" --include="*.tsx" | grep -v "lib/resend"
done

# Check that webhook routes are NOT touched by middleware
node -e "const m=require('./middleware.ts').config.matcher; console.log(m)"
```
