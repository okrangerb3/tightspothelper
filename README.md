# TightSpotHelper

On-demand expert help via video session — connect customers with vetted pros to diagnose and fix things remotely.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Auth | Supabase Auth (email, Google, Apple) |
| Database | Supabase / PostgreSQL |
| Video | Daily.co (cloud recording) |
| Payments | Stripe Connect |
| Storage | Cloudflare R2 (recordings + photos) |
| Email | Resend |
| Background checks | Checkr |
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
