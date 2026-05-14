#!/usr/bin/env bash
# Apply the TightSpotHelper fix pack.
# Run from the root of the tightspothelper repo:
#   bash apply-fixes.sh
set -e

if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run this from the root of the tightspothelper repo (where package.json lives)." >&2
  exit 1
fi

mkdir -p lib/checkr app/api/sessions app/api/webhooks/checkr app/api/stripe/portal

echo '→ writing lib/checkr/index.ts'
cat > 'lib/checkr/index.ts' << 'TSH_EOF_MARKER'
// Checkr API client — minimal wrapper around the REST endpoints we use.
//
// Auth: HTTP Basic with `${CHECKR_API_KEY}:` (empty password) — Checkr's standard scheme.
// Docs: https://docs.checkr.com/

const BASE = process.env.CHECKR_API_BASE_URL ?? 'https://api.checkr.com/v1'

function authHeader() {
  const key = process.env.CHECKR_API_KEY
  if (!key) throw new Error('CHECKR_API_KEY is not set')
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
}

async function checkr<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': authHeader(),
      'Content-Type':  'application/x-www-form-urlencoded',
      ...(init.headers ?? {}),
    },
    // Important — avoid Next.js caching API calls
    cache: 'no-store',
  })

  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }

  if (!res.ok) {
    const msg = json?.error ?? json?.message ?? text ?? `Checkr ${res.status}`
    throw new Error(`Checkr API ${res.status}: ${msg}`)
  }
  return json as T
}

function form(obj: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v))
  }
  return sp.toString()
}

/** Initiate a background check for an expert applicant.
 *  Creates a Candidate, then invites them to complete their info via a hosted Invitation,
 *  then orders the configured Package. Returns IDs we persist for webhook reconciliation. */
export async function initiateBackgroundCheck(params: {
  email:      string
  firstName:  string
  lastName:   string
  middleName?: string
  phone?:     string
}): Promise<{ candidateId: string; reportId: string | null; invitationId: string | null }> {
  const candidate = await checkr<{ id: string }>('/candidates', {
    method: 'POST',
    body:   form({
      email:       params.email,
      first_name:  params.firstName,
      last_name:   params.lastName,
      middle_name: params.middleName,
      phone:       params.phone,
      // Required by Checkr — applicant fills the rest via the Invitation flow
      no_middle_name: params.middleName ? undefined : true,
    }),
  })

  // Create an Invitation — applicant completes SSN/DOB/etc on Checkr-hosted form.
  // The package slug is configured on the Checkr account (typical: 'tasker_pro_full_criminal').
  const packageSlug = process.env.CHECKR_PACKAGE ?? 'tasker_pro_full_criminal'

  let invitationId: string | null = null
  let reportId:     string | null = null

  try {
    const invitation = await checkr<{ id: string }>('/invitations', {
      method: 'POST',
      body:   form({ candidate_id: candidate.id, package: packageSlug }),
    })
    invitationId = invitation.id
  } catch (err) {
    // If invitations aren't supported on this account, fall back to ordering a Report
    // directly — applicant data must then come from the candidate record alone.
    console.warn('Checkr invitation creation failed, falling back to direct report:', err)
    try {
      const report = await checkr<{ id: string }>('/reports', {
        method: 'POST',
        body:   form({ candidate_id: candidate.id, package: packageSlug }),
      })
      reportId = report.id
    } catch (reportErr) {
      console.error('Checkr report creation also failed:', reportErr)
    }
  }

  return { candidateId: candidate.id, reportId, invitationId }
}

/** Fetch the latest report for a candidate (used by webhook). */
export async function fetchReport(reportId: string) {
  return checkr<{
    id:     string
    status: 'pending' | 'clear' | 'consider' | 'suspended' | 'dispute'
    result: 'clear' | 'consider' | null
    candidate_id: string
    completed_at: string | null
    adjudication: 'engaged' | 'pre_adverse_action' | 'post_adverse_action' | null
  }>(`/reports/${reportId}`, { method: 'GET' })
}

/** Verify a Checkr webhook payload using the configured signing secret.
 *  Checkr signs with HMAC-SHA256 of the raw body, sent as `X-Checkr-Signature`. */
export function verifyCheckrSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CHECKR_WEBHOOK_SECRET
  if (!secret) {
    console.warn('CHECKR_WEBHOOK_SECRET not set — refusing webhook')
    return false
  }
  if (!signatureHeader) return false

  // Sync import to avoid top-level await complications in older Node runtimes.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac, timingSafeEqual } = require('node:crypto')
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')

  // Some Checkr accounts send `sha256=<hex>` instead of plain hex — handle both.
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader

  if (expected.length !== provided.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  } catch {
    return false
  }
}

/** Map a Checkr report status to our boolean `backgroundCheckPassed`.
 *  - `clear`            → passed (true)
 *  - `consider`/`suspended` → failed (false)
 *  - `pending`/`dispute` → unknown (null) — leave the column unchanged. */
export function reportStatusToPassed(status: string, result: string | null): boolean | null {
  if (status === 'clear' || result === 'clear') return true
  if (status === 'consider' || status === 'suspended' || result === 'consider') return false
  return null
}
TSH_EOF_MARKER

echo '→ writing app/api/webhooks/checkr/route.ts'
cat > 'app/api/webhooks/checkr/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchReport, verifyCheckrSignature, reportStatusToPassed } from '@/lib/checkr'

// Checkr webhook entry point.
// Configure this URL in the Checkr dashboard:
//   https://<your-domain>/api/webhooks/checkr
// and subscribe to at least: report.completed, report.suspended, report.disputed,
// report.upgraded, report.post_adverse_action, report.adjudicated.
//
// `middleware.ts` matcher is scoped to /customer, /expert, /admin — this route
// is therefore NOT auth-gated by middleware. We verify the HMAC signature instead.

// Disable Next.js body parsing — we need the raw body for signature verification.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-checkr-signature')

  if (!verifyCheckrSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type    = event?.type ?? ''
  const payload = event?.data?.object ?? event?.object ?? {}

  // We only care about events that change a report's outcome
  const TERMINAL = new Set([
    'report.completed',
    'report.suspended',
    'report.disputed',
    'report.resumed',
    'report.upgraded',
    'report.adjudicated',
    'report.post_adverse_action',
  ])

  if (!TERMINAL.has(type)) {
    return NextResponse.json({ ok: true, ignored: type })
  }

  const reportId    = payload.id              ?? payload.report_id ?? null
  const candidateId = payload.candidate_id    ?? null
  const status      = payload.status          ?? null
  const result      = payload.result          ?? null

  if (!reportId && !candidateId) {
    return NextResponse.json({ error: 'No report or candidate id in payload' }, { status: 400 })
  }

  // Re-fetch from the source of truth in case the webhook payload is partial.
  let fetched: Awaited<ReturnType<typeof fetchReport>> | null = null
  if (reportId) {
    try {
      fetched = await fetchReport(reportId)
    } catch (err) {
      console.error('Checkr report refetch failed:', err)
    }
  }

  const finalStatus = fetched?.status ?? status
  const finalResult = fetched?.result ?? result
  const finalCandId = fetched?.candidate_id ?? candidateId

  const passed = reportStatusToPassed(String(finalStatus ?? ''), finalResult ?? null)

  // Match by report id first, then by candidate id as a fallback.
  const profile = await prisma.expertProfile.findFirst({
    where: {
      OR: [
        reportId    ? { checkrReportId:    reportId }    : undefined,
        finalCandId ? { checkrCandidateId: finalCandId } : undefined,
      ].filter(Boolean) as any,
    },
    select: { id: true, status: true },
  })

  if (!profile) {
    // Don't 404 — Checkr will retry. Log and ack so a stale check doesn't keep retrying forever.
    console.warn('Checkr webhook for unknown expert', { reportId, candidateId: finalCandId, type })
    return NextResponse.json({ ok: true, matched: false })
  }

  await prisma.expertProfile.update({
    where: { id: profile.id },
    data: {
      checkrReportId:        reportId ?? undefined,
      checkrCandidateId:     finalCandId ?? undefined,
      backgroundCheckPassed: passed,
      // If a previously approved expert came back failed, auto-suspend them.
      // We never auto-approve based on a passed BG check — admin must still review.
      ...(passed === false && profile.status === 'approved' ? { status: 'suspended' as any } : {}),
    },
  })

  return NextResponse.json({ ok: true, matched: true, passed })
}
TSH_EOF_MARKER

echo '→ writing app/api/stripe/portal/route.ts'
cat > 'app/api/stripe/portal/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

// POST /api/stripe/portal
// Creates a Stripe Customer Portal session and returns the URL to redirect to.
// Customers use this to manage saved payment methods, view past charges,
// and (in the future) cancel/upgrade storage subscriptions.

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true, email: true, name: true },
  })

  // If the user has never had a card or session, they have no Stripe customer yet.
  // Auto-create one so the portal can open — the portal will just be empty.
  let customerId = user?.stripeCustomerId ?? null
  if (!customerId) {
    const c = await stripe.customers.create({
      email:    user?.email ?? session.user.email,
      name:     user?.name  ?? session.user.name ?? undefined,
      metadata: { user_id: session.user.id },
    })
    customerId = c.id
    await prisma.authUser.update({
      where: { id: session.user.id },
      data:  { stripeCustomerId: customerId },
    })
  }

  // Optional `returnTo` body param so the portal can drop the user back where they came from.
  let returnTo = '/customer/payment-methods'
  try {
    const body = await req.json()
    if (typeof body?.returnTo === 'string' && body.returnTo.startsWith('/')) {
      returnTo = body.returnTo
    }
  } catch { /* no body, use default */ }

  const portal = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${returnTo}`,
  })

  return NextResponse.json({ url: portal.url })
}
TSH_EOF_MARKER

echo '→ writing app/api/sessions/route.ts'
cat > 'app/api/sessions/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { calculateSessionPricing, createSessionPaymentIntent, stripe } from '@/lib/stripe'
import { sendSessionConfirmation, sendExpertNewBooking } from '@/lib/resend'
import { z } from 'zod'

const CreateSessionSchema = z.object({
  expertId:           z.string().uuid(),
  categoryId:         z.string().uuid(),
  durationMinutes:    z.number().int().min(15).max(120),
  problemTitle:       z.string().min(5).max(200),
  problemDescription: z.string().min(10),
  scheduledAt:        z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const { session: auth, error } = await requireAuth()
  if (error) return error

  const body   = await req.json()
  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { expertId, categoryId, durationMinutes, problemTitle, problemDescription, scheduledAt } = parsed.data

  // Fetch category + expert profile + expert user record in parallel.
  // We need the expert's user row separately to get their email/name for the notification.
  const [category, expert, expertUser] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId } }),
    prisma.expertProfile.findUnique({ where: { id: expertId } }),
    prisma.authUser.findUnique({ where: { id: expertId }, select: { email: true, name: true } }),
  ])

  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  if (!expert || expert.status !== 'approved')
    return NextResponse.json({ error: 'Expert unavailable' }, { status: 400 })
  if (!expert.stripeConnectId || !expert.stripeConnectOnboarded) {
    return NextResponse.json(
      { error: 'Expert payout account is not configured' },
      { status: 400 },
    )
  }

  // Ensure Stripe customer exists for the booking customer
  const customerUser = await prisma.authUser.findUnique({ where: { id: auth.user.id } })
  let stripeCustomerId = customerUser?.stripeCustomerId

  if (!stripeCustomerId) {
    const sc = await stripe.customers.create({
      email:    auth.user.email,
      name:     auth.user.name ?? undefined,
      metadata: { user_id: auth.user.id },
    })
    stripeCustomerId = sc.id
    await prisma.authUser.update({
      where: { id: auth.user.id },
      data:  { stripeCustomerId: sc.id },
    })
  }

  const [customer, paymentMethods] = await Promise.all([
    stripe.customers.retrieve(stripeCustomerId),
    stripe.customers.listPaymentMethods(stripeCustomerId, { type: 'card', limit: 10 }),
  ])

  const defaultPaymentMethodId =
    typeof customer !== 'string' && !customer.deleted
      ? (customer.invoice_settings?.default_payment_method as string | null)
      : null

  const paymentMethod =
    (defaultPaymentMethodId && paymentMethods.data.find(method => method.id === defaultPaymentMethodId)) ||
    paymentMethods.data[0]

  if (!paymentMethod) {
    return NextResponse.json(
      { error: 'No saved payment method found', redirectTo: '/customer/payment-methods' },
      { status: 402 },
    )
  }

  // Active fee override check
  const now = new Date()
  const override = await prisma.feeOverride.findFirst({
    where: {
      categoryId,
      startsAt: { lte: now },
      endsAt:   { gte: now },
    },
  })

  const feeValue = override ? Number(override.overrideValue) : Number(category.feeValue)

  const pricing = calculateSessionPricing({
    expertRatePerHour: Number(expert.hourlyRate!),
    durationMinutes,
    feeType:   category.feeType as any,
    feeValue,
    flatTiers: category.feeFlatTiers as any ?? undefined,
  })

  const sessionId = crypto.randomUUID()

  const paymentIntent = await createSessionPaymentIntent({
    customerId:      stripeCustomerId,
    expertConnectId: expert.stripeConnectId,
    amountCents:     Math.round(pricing.customerTotal * 100),
    payoutCents:     Math.round(pricing.expertPayout  * 100),
    sessionId,
    paymentMethodId: paymentMethod.id,
  })

  if (paymentIntent.status !== 'requires_capture') {
    return NextResponse.json(
      {
        error: 'Payment requires customer action',
        clientSecret: paymentIntent.client_secret,
        paymentIntentStatus: paymentIntent.status,
      },
      { status: 402 },
    )
  }

  const newSession = await prisma.session.create({
    data: {
      id:                   sessionId,
      customerId:           auth.user.id,
      expertId,
      categoryId,
      status:               'pending',
      scheduledAt:          scheduledAt ? new Date(scheduledAt) : new Date(),
      expertHourlyRate:     expert.hourlyRate!,
      platformFeeType:      category.feeType as any,
      platformFeeValue:     feeValue,
      expertPayout:         pricing.expertPayout,
      platformFee:          pricing.platformFee,
      problemTitle,
      problemDescription,
      stripePaymentIntentId: paymentIntent.id,
      paymentStatus:         'held',
    },
  })

  // ── Send notifications in background (non-blocking) ──────────────────
  //
  // Both customer and expert get an email. Previously the expert email was
  // not being sent, and the customer's confirmation used the customer's own
  // name as the expert name (because we only had `auth.user.name` in scope).
  const customerEmail = auth.user.email
  const customerName  = auth.user.name ?? 'there'
  const expertName    = expertUser?.name ?? 'your expert'
  const expertEmail   = expertUser?.email ?? null
  const scheduledIso  = scheduledAt ?? newSession.scheduledAt?.toISOString() ?? new Date().toISOString()

  Promise.all([
    sendSessionConfirmation(customerEmail, {
      customerName,
      expertName,
      categoryName: category.name,
      sessionId:    newSession.id,
      scheduledAt:  scheduledIso,
      totalAmount:  pricing.customerTotal,
    }),
    expertEmail
      ? sendExpertNewBooking(expertEmail, {
          expertName,
          customerName,
          categoryName: category.name,
          sessionId:    newSession.id,
          problemTitle,
          scheduledAt:  scheduledIso,
          payout:       pricing.expertPayout,
        })
      : Promise.resolve(null),
  ]).catch(e => console.error('Session notification emails failed:', e))

  return NextResponse.json({ session: newSession, pricing })
}

export async function GET(_req: NextRequest) {
  const { session: auth, error } = await requireAuth()
  if (error) return error

  const sessions = await prisma.session.findMany({
    where: {
      OR: [
        { customerId: auth.user.id },
        { expertId:   auth.user.id },
      ],
    },
    include: {
      expert:   { select: { name: true } },
      customer: { select: { name: true } },
      category: { select: { name: true, icon: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ sessions })
}
TSH_EOF_MARKER

echo '→ writing COPILOT.md'
cat > 'COPILOT.md' << 'TSH_EOF_MARKER'
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
TSH_EOF_MARKER

echo ""
echo "✓ Fix pack applied. Next steps:"
echo "  1. Add to .env.local:  CHECKR_API_KEY, CHECKR_WEBHOOK_SECRET, CHECKR_PACKAGE"
echo "  2. Configure the Checkr webhook URL in the Checkr dashboard"
echo "  3. Run:  npx prisma generate && npx tsc --noEmit"
echo "  4. git diff   to review, then commit"
