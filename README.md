# TightSpotHelper

On-demand expert help via video session — connect customers with vetted pros to diagnose and fix things remotely.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Auth | Better Auth v1.1 (email, Google, Apple) |
| Database | Prisma + PostgreSQL (Railway) |
| Realtime | Socket.IO via custom `server.ts` |
| Video | Jitsi (self-hosted) |
| Recording | Jibri (self-hosted) + Cloudflare R2 |
| Payments | Stripe Connect |
| Storage | Cloudflare R2 (recordings + photos) |
| Email | Resend |
| Hosting / CI/CD | Railway (auto-deploy from GitHub) |

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/okrangerb3/tightspothelper
cd tightspothelper
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` (see services below).

### 3. Database (Prisma + Railway Postgres)

1. Create a PostgreSQL service in your [Railway](https://railway.app) project
2. Copy the `DATABASE_URL` into `.env.local`
3. Run migrations:

```bash
npx prisma migrate deploy
```

4. (Optional) Seed dev data:

```bash
npm run db:seed
```

### 4. Stripe

1. Create account at [stripe.com](https://stripe.com)
2. Enable Connect for your account
3. Set up webhook at `https://yourdomain.com/api/webhooks/stripe`
4. Enable events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`

### 5. Cloudflare R2

1. Create R2 bucket named `tightspothelper-recordings`
2. Create API token with R2 read/write permissions
3. Set CORS policy on bucket to allow your domain

### 6. Jitsi + Jibri (video & recording)

The repo owner provisions the Jitsi/Jibri server. Set the following env vars:

```
JITSI_DOMAIN=meet.yourdomain.com
JITSI_JWT_APP_ID=tightspothelper
JITSI_JWT_SECRET=<secret>
JIBRI_API_URL=https://jibri.yourdomain.com
JIBRI_API_TOKEN=<token>
JIBRI_WEBHOOK_SECRET=<secret>
```

### 7. Railway deployment

1. Create project at [railway.app](https://railway.app)
2. Connect to `okrangerb3/tightspothelper` GitHub repo
3. Add all env vars from `.env.example` to Railway dashboard
4. Railway auto-deploys on push to `main`

---

## Project Structure

```
app/
  (auth)/           Login, signup pages
  (customer)/       Customer dashboard, booking, session pages
  (expert)/         Expert dashboard, application, session pages
  (admin)/          Admin panel — categories, pros, sessions, recordings
  api/
    sessions/       Session CRUD + Jitsi room token
    recordings/     Recording access + pay-per-recording purchase
    photos/         Presigned R2 upload URLs, photo records
    payments/       Stripe payment flow
    webhooks/
      jibri/        Recording finalized callback
      stripe/       Payment events, Connect updates
    cron/
      expire-recordings/   Cleanup of expired recordings from R2
      recording-upsell/    Day-25 upsell email job

components/
  shell/
    Shell.tsx       Sidebar + top bar (role-aware nav, NotificationBell)
    NotificationBell.tsx  Real-time notification bell via Socket.IO
  session/
    VideoCall.tsx   Jitsi IFrame API wrapper
    PhotoPanel.tsx  Real-time photo sharing (pre + during session) via Socket.IO
    ChatPanel.tsx   In-session text chat via Socket.IO

lib/
  db.ts             Prisma singleton
  auth.ts           Better Auth config
  auth-client.ts    Better Auth browser client
  jitsi/            Room name derivation + JWT minting
  jibri/            REST client for Jibri start/stop API
  stripe/           Pricing calculation, PaymentIntents, Connect
  r2/               Presigned URLs, upload/download, cron deletes
  resend/           Email helpers
```

---

## Key Business Logic

### Fee calculation

Fees are configured per category in the `categories` table:
- **Percentage**: `feeValue = 0.20` → 20% of session subtotal added on top
- **Flat by duration**: `feeFlatTiers = {"15":4,"30":6,...}` → fixed dollar fee per session length tier

Customers always see one total price. Experts see the full breakdown.

### Recording lifecycle

1. Session ends → expert clicks "Stop recording" → calls Jibri stop API
2. Jibri finishes encoding → POSTs to `/api/webhooks/jibri`
3. Webhook downloads recording → stores in Cloudflare R2
4. DB `Recording` row created: `purchaseStatus = free_window`, `expiresAt = now + 30 days`
5. Both parties notified via email + in-app notification
6. Day 25: upsell email sent (Railway cron)
7. Day 30: Railway cron deletes from R2, sets `purchaseStatus = expired`

### Payments

Sessions use Stripe's `capture_method: manual` — funds are held at booking, captured after session completes. Expert payout is handled via Stripe Connect `transfer_data`.

---

## Admin Panel

The admin panel at `/admin` provides full management of:
- **Categories** — fee type, value, rate guardrails, active/inactive
- **Pro applications** — review, approve/reject/suspend
- **Sessions** — live monitor, history, dispute resolution + refunds
- **Recordings** — per-recording status, extend expiry, force-delete

---

## Development

```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Run pending migrations (production)
npm run db:push      # Push schema changes without migration (dev only)
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed dev data
```

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/okrangerb3/tightspothelper
cd tightspothelper
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` (see services below).

### 3. Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key into `.env.local`
3. Run the migration:

```bash
# Option A — Supabase CLI
npx supabase db push

# Option B — paste into Supabase SQL editor
# Copy contents of supabase/migrations/001_initial.sql
```

4. Generate TypeScript types:

```bash
npm run db:types
```

### 4. Daily.co

1. Create account at [daily.co](https://daily.co)
2. Get your API key from the dashboard
3. Set up a webhook pointing to `https://yourdomain.com/api/webhooks/daily`
4. Enable events: `recording.ready-to-download`, `meeting.ended`

### 5. Stripe

1. Create account at [stripe.com](https://stripe.com)
2. Enable Connect for your account
3. Create products/prices for storage subscriptions:
   - Basic (10GB): `STRIPE_PRICE_STORAGE_BASIC`
   - Pro (50GB): `STRIPE_PRICE_STORAGE_PRO`
   - Unlimited: `STRIPE_PRICE_STORAGE_UNLIMITED`
4. Set up webhook at `https://yourdomain.com/api/webhooks/stripe`
5. Enable events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.subscription.updated`

### 6. Cloudflare R2

1. Create R2 bucket named `tightspothelper-recordings`
2. Create API token with R2 read/write permissions
3. Set CORS policy on bucket to allow your domain

### 7. Railway deployment

1. Create project at [railway.app](https://railway.app)
2. Connect to `okrangerb3/tightspothelper` GitHub repo
3. Add all env vars from `.env.example` to Railway dashboard
4. Railway auto-deploys on push to `main`

---

## Project Structure

```
app/
  (auth)/           Login, signup pages
  (customer)/       Customer dashboard, booking, session pages  
  (expert)/         Expert dashboard, application, session pages
  (admin)/          Admin panel — categories, pros, sessions, recordings
  api/
    sessions/       Session CRUD + Daily.co room creation
    recordings/     Recording access, purchase, storage plan
    photos/         Presigned upload URLs, photo records
    payments/       Stripe payment flow
    webhooks/
      daily/        Recording ready, meeting ended
      stripe/       Payment events, subscription updates
    cron/
      expire-recordings/   Daily cleanup of expired free recordings
      recording-upsell/    Day-25 upsell email job

components/
  session/
    VideoCall.tsx   Daily.co iframe wrapper with recording controls
    PhotoPanel.tsx  Real-time photo sharing (pre + during session)
    ChatPanel.tsx   In-session text chat via Supabase Realtime
  admin/            Admin-specific components
  ui/               Shared UI components

lib/
  supabase/         Browser + server + admin clients
  daily/            Room creation, tokens, webhook verification
  stripe/           Pricing calculation, PaymentIntents, Connect
  r2/               Presigned URLs, upload/download, cron deletes
```

---

## Key Business Logic

### Fee calculation

Fees are configured per category in the `categories` table:
- **Percentage**: `fee_value = 0.20` → 20% of session subtotal added on top
- **Flat by duration**: `fee_flat_tiers = {"15":4,"30":6,...}` → fixed dollar fee per session length tier

Customers always see one total price. Experts see the full breakdown.

### Recording lifecycle

1. Session ends → Daily.co fires `recording.ready-to-download` webhook
2. API downloads recording → stores in Cloudflare R2 under `sessions/{id}/recording.mp4`
3. Admin master copy stored at `sessions/{id}/recording_admin.mp4` (never auto-deleted)
4. DB record created with `expires_at = now() + 30 days`, `plan = free`
5. Both parties notified via email + in-app
6. Day 25: upsell email sent (Railway cron)
7. Day 30: Railway cron deletes from R2, sets `deleted_at` in DB

### Payments

Sessions use Stripe's `capture_method: manual` — funds are held at booking, captured after session completes. Expert payout is handled via Stripe Connect `transfer_data`.

---

## Admin Panel

The admin panel at `/admin` provides full management of:
- **Categories** — fee type, value, rate guardrails, active/inactive
- **Pro applications** — review, Checkr results, approve/reject
- **Sessions** — live monitor, history, dispute resolution
- **Recordings** — storage overview, manual extends, admin access
- **Analytics** — revenue, category breakdown, growth metrics

---

## Development

```bash
npm run dev        # Start dev server on localhost:3000
npm run build      # Production build
npm run lint       # ESLint
npm run db:types   # Regenerate Supabase TypeScript types
```
