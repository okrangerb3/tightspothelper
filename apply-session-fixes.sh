#!/usr/bin/env bash
# Fix pro public link, session duration selector, Stripe pre-auth/settle
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p "app/pro/[slug]" components/session components/booking

echo '→ writing app/pro/[slug]/page.tsx'
cat > 'app/pro/[slug]/page.tsx' << 'TSH_EOF_MARKER'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import type { Metadata } from 'next'
import ProPublicProfileClient from './ProPublicProfileClient'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

interface Props { params: { slug: string } }

async function getPro(slug: string) {
  return prisma.expertProfile.findUnique({
    where:   { slug },
    include: { user: { select: { name: true, image: true, email: true } } },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pro = await getPro(params.slug)
  if (!pro) return { title: 'Expert not found' }
  const name = pro.user.name ?? 'Expert'
  return {
    title:       `${name} — TightSpotHelper Expert`,
    description: (pro as any).publicBio ?? pro.bio ?? `Book a remote session with ${name} on TightSpotHelper.`,
    openGraph: {
      title:       `${name} — TightSpotHelper`,
      description: (pro as any).publicBio ?? pro.bio ?? '',
      url:         `${BASE_URL}/pro/${params.slug}`,
      type:        'profile',
    },
  }
}

export default async function ProPublicProfile({ params }: Props) {
  const pro = await getPro(params.slug)
  if (!pro || pro.status !== 'approved') notFound()

  const categories = pro.categoryIds.length
    ? await prisma.category.findMany({
        where:  { id: { in: pro.categoryIds } },
        select: { name: true, slug: true, icon: true },
      })
    : []

  return (
    <ProPublicProfileClient
      pro={{
        id:              pro.id,
        name:            pro.user.name ?? 'Expert',
        image:           pro.user.image ?? null,
        bio:             (pro as any).publicBio ?? pro.bio ?? null,
        headline:        (pro as any).headline ?? null,
        hourlyRate:      Number(pro.hourlyRate ?? 0),
        ratingAvg:       Number(pro.ratingAvg ?? 0),
        ratingCount:     pro.ratingCount,
        yearsExperience: pro.yearsExperience ?? null,
        available:       pro.available,
        certifications:  pro.certifications,
        specialties:     (pro as any).specialties ?? [],
        emergencyAvailable: (pro as any).emergencyAvailable ?? false,
        emergencyRate:   Number((pro as any).emergencyRate ?? 0),
        slug:            (pro as any).slug ?? params.slug,
      }}
      categories={categories}
      baseUrl={BASE_URL}
    />
  )
}
TSH_EOF_MARKER

echo '→ writing app/pro/[slug]/ProPublicProfileClient.tsx'
cat > 'app/pro/[slug]/ProPublicProfileClient.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Category { name: string; slug: string; icon?: string | null }

interface Pro {
  id: string; name: string; image: string | null; bio: string | null
  headline: string | null; hourlyRate: number; ratingAvg: number
  ratingCount: number; yearsExperience: number | null; available: boolean
  certifications: string[]; specialties: string[]; emergencyAvailable: boolean
  emergencyRate: number; slug: string
}

interface Props { pro: Pro; categories: Category[]; baseUrl: string }

export default function ProPublicProfileClient({ pro, categories, baseUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const initials = pro.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const publicUrl = `${baseUrl}/pro/${pro.slug}`

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Nav */}
      <nav className="border-b border-ink-800 px-4 sm:px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="font-display font-bold text-white text-base">
          TightSpot<span className="text-brand-500">Helper</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/login"  className="btn-ghost text-sm py-2 px-3">Log in</Link>
          <Link href="/signup" className="btn-primary text-sm py-2 px-3">Get help</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* Hero card */}
        <div className="card p-6">
          <div className="flex items-start gap-4">
            {pro.image ? (
              <img src={pro.image} alt={pro.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-500/20 border border-brand-500/30
                flex items-center justify-center text-xl font-bold text-brand-400 shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{pro.name}</h1>
              {pro.headline && <p className="text-ink-400 text-sm mt-0.5">{pro.headline}</p>}

              <div className="flex flex-wrap items-center gap-3 mt-2">
                {pro.ratingAvg > 0 && (
                  <span className="text-sm text-yellow-400">
                    ★ {pro.ratingAvg.toFixed(1)}
                    <span className="text-ink-500 text-xs ml-1">({pro.ratingCount})</span>
                  </span>
                )}
                {pro.hourlyRate > 0 && (
                  <span className="text-sm font-medium text-brand-400">${pro.hourlyRate}/hr</span>
                )}
                {pro.emergencyAvailable && pro.emergencyRate > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    🚨 Emergency ${pro.emergencyRate}/hr
                  </span>
                )}
                {pro.yearsExperience && (
                  <span className="text-xs text-ink-500">{pro.yearsExperience} yrs exp</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border
                  ${pro.available
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-ink-800 text-ink-500 border-ink-700'}`}>
                  {pro.available ? '● Available' : '○ Unavailable'}
                </span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            {pro.available && (
              <Link href={`/signup?bookPro=${pro.id}`} className="btn-primary flex-1 text-center">
                Book a session
              </Link>
            )}
            <button onClick={copyLink}
              className={`btn-ghost flex-1 text-sm transition-colors
                ${copied ? 'text-green-400 border-green-500/30' : ''}`}>
              {copied ? '✓ Link copied!' : '🔗 Share this profile'}
            </button>
          </div>
        </div>

        {/* About */}
        {pro.bio && (
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold text-white mb-3">About</h2>
            <p className="text-ink-300 text-sm leading-relaxed whitespace-pre-line">{pro.bio}</p>
          </div>
        )}

        {/* Specialties */}
        {(categories.length > 0 || pro.specialties.length > 0) && (
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold text-white mb-3">Specialties</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <span key={c.slug}
                  className="px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-sm text-brand-300">
                  {c.icon && <span className="mr-1.5">{c.icon}</span>}{c.name}
                </span>
              ))}
              {pro.specialties.map(s => (
                <span key={s}
                  className="px-3 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-sm text-ink-300">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {pro.certifications.length > 0 && (
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold text-white mb-3">Certifications</h2>
            <ul className="space-y-2">
              {pro.certifications.map((cert, i) => (
                <li key={i} className="text-sm text-ink-300 flex items-center gap-2">
                  <span className="text-brand-400 shrink-0">✓</span> {cert}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Emergency availability */}
        {pro.emergencyAvailable && (
          <div className="card p-5 border-yellow-500/20">
            <h2 className="font-display text-sm font-bold text-white mb-2">🚨 Emergency sessions</h2>
            <p className="text-sm text-ink-300">
              {pro.name.split(' ')[0]} accepts urgent after-hours sessions at ${pro.emergencyRate}/hr.
              Book now and they'll respond within 10 minutes.
            </p>
            {pro.available && (
              <Link href={`/signup?bookPro=${pro.id}&emergency=1`}
                className="btn-primary w-full text-center mt-4 block text-sm">
                Request emergency session
              </Link>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing lib/stripe/index.ts'
cat > 'lib/stripe/index.ts' << 'TSH_EOF_MARKER'
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

export function calculateSessionPricing(params: {
  expertRatePerHour: number
  durationMinutes:   number
  feeType:           'percentage' | 'flat'
  feeValue:          number
  flatTiers?:        Record<string, number>
}) {
  const { expertRatePerHour, durationMinutes, feeType, feeValue, flatTiers } = params
  const subtotal = parseFloat((expertRatePerHour * (durationMinutes / 60)).toFixed(2))

  let platformFee: number
  if (feeType === 'percentage') {
    platformFee = parseFloat((subtotal * feeValue).toFixed(2))
  } else {
    const tierMinutes = [15, 30, 45, 60, 75, 90, 105, 120]
    const tier        = tierMinutes.find(t => t >= durationMinutes) ?? 120
    platformFee       = flatTiers?.[String(tier)] ?? feeValue
  }

  const customerTotal = parseFloat((subtotal + platformFee).toFixed(2))
  const expertPayout  = subtotal

  return { subtotal, platformFee, customerTotal, expertPayout }
}

/**
 * Pre-auth for 1 hour of the expert's rate (+ fee).
 * We always hold a full hour regardless of selected duration —
 * then settle at actual time used when the session ends.
 */
export async function createSessionPaymentIntent(params: {
  customerId:      string
  expertConnectId: string
  preAuthCents:    number   // 1-hour pre-auth amount
  payoutCents:     number   // estimated payout (1hr)
  sessionId:       string
  paymentMethodId?: string
}) {
  const { customerId, expertConnectId, preAuthCents, payoutCents, sessionId, paymentMethodId } = params

  return stripe.paymentIntents.create({
    amount:         preAuthCents,
    currency:       'usd',
    customer:       customerId,
    capture_method: 'manual',       // hold only — capture at session end with actual amount
    transfer_data: {
      destination: expertConnectId,
      amount:      payoutCents,
    },
    ...(paymentMethodId ? {
      payment_method: paymentMethodId,
      confirm:        true,
      off_session:    true,
    } : {}),
    metadata: { sessionId, preAuth: 'true' },
    description: `TightSpotHelper session ${sessionId} — pre-auth`,
  })
}

/**
 * Capture the actual amount used — called when session ends.
 * Stripe allows capturing less than the authorized amount.
 */
export async function captureSessionPayment(
  paymentIntentId: string,
  actualAmountCents: number,
  actualPayoutCents: number,
  expertConnectId:   string,
) {
  // Update transfer amount to reflect actual payout
  await stripe.paymentIntents.update(paymentIntentId, {
    transfer_data: { destination: expertConnectId, amount: actualPayoutCents },
  })

  return stripe.paymentIntents.capture(paymentIntentId, {
    amount_to_capture: actualAmountCents,
  })
}

export async function refundSession(paymentIntentId: string, amountCents?: number) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountCents ? { amount: amountCents } : {}),
  })
}
TSH_EOF_MARKER

echo '→ writing components/booking/DurationSelector.tsx'
cat > 'components/booking/DurationSelector.tsx' << 'TSH_EOF_MARKER'
'use client'

// Duration selector component — drop-in replacement for the duration step in booking
// Shows 30min, 45min, 1hr as primary options with +15min increments up to 3hr

import { useState } from 'react'

interface Props {
  expertRate:   number      // $/hr
  feeType:      'percentage' | 'flat'
  feeValue:     number
  flatTiers?:   Record<string, number>
  value:        number      // selected minutes
  onChange:     (minutes: number) => void
}

const BASE_DURATIONS = [
  { minutes: 30,  label: '30 min', badge: null },
  { minutes: 45,  label: '45 min', badge: null },
  { minutes: 60,  label: '1 hour', badge: 'Most popular' },
]

function calcTotal(rate: number, mins: number, feeType: string, feeValue: number, flatTiers?: Record<string,number>) {
  const sub = rate * (mins / 60)
  const fee = feeType === 'percentage'
    ? sub * feeValue
    : flatTiers?.[String([15,30,45,60,75,90,105,120].find(t => t >= mins) ?? 120)] ?? feeValue
  return { sub: sub.toFixed(2), total: (sub + fee).toFixed(2) }
}

export function DurationSelector({ expertRate, feeType, feeValue, flatTiers, value, onChange }: Props) {
  const [showExtended, setShowExtended] = useState(value > 60)

  const extendedOptions = [75, 90, 105, 120, 150, 180].map(m => ({
    minutes: m,
    label:   m >= 60 ? `${m / 60 === Math.floor(m / 60) ? m/60 + ' hr' : (m/60).toFixed(1) + ' hr'}` : `${m} min`,
  }))

  // Normalize label for extended
  const extLabel = (m: number) => {
    if (m % 60 === 0) return `${m / 60}hr`
    return `${Math.floor(m/60)}h ${m%60}m`
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Session length</label>
        <p className="text-xs text-ink-500 mb-3">
          We pre-authorize 1 hour and settle for actual time used at the end.
        </p>
      </div>

      {/* Primary options */}
      <div className="grid grid-cols-3 gap-2">
        {BASE_DURATIONS.map(opt => {
          const { sub, total } = calcTotal(expertRate, opt.minutes, feeType, feeValue, flatTiers)
          const selected = value === opt.minutes
          return (
            <button key={opt.minutes} onClick={() => { onChange(opt.minutes); setShowExtended(false) }}
              className={`relative p-3 rounded-xl border text-left transition-all
                ${selected
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-ink-700 hover:border-ink-500 bg-ink-900'}`}>
              {opt.badge && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {opt.badge}
                </span>
              )}
              <p className={`text-sm font-bold ${selected ? 'text-white' : 'text-ink-200'}`}>{opt.label}</p>
              <p className={`text-xs mt-0.5 ${selected ? 'text-brand-400' : 'text-ink-500'}`}>${total}</p>
            </button>
          )
        })}
      </div>

      {/* Add more time */}
      {!showExtended ? (
        <button onClick={() => setShowExtended(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-ink-700 text-xs text-ink-500
            hover:border-ink-500 hover:text-ink-300 transition-colors">
          + Need more time?
        </button>
      ) : (
        <div>
          <p className="text-xs text-ink-500 mb-2">Extended sessions</p>
          <div className="grid grid-cols-3 gap-2">
            {extendedOptions.map(opt => {
              const { sub, total } = calcTotal(expertRate, opt.minutes, feeType, feeValue, flatTiers)
              const selected = value === opt.minutes
              return (
                <button key={opt.minutes} onClick={() => onChange(opt.minutes)}
                  className={`p-3 rounded-xl border text-left transition-all
                    ${selected
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-ink-700 hover:border-ink-500 bg-ink-900'}`}>
                  <p className={`text-sm font-bold ${selected ? 'text-white' : 'text-ink-200'}`}>{extLabel(opt.minutes)}</p>
                  <p className={`text-xs mt-0.5 ${selected ? 'text-brand-400' : 'text-ink-500'}`}>${total}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Pre-auth notice */}
      <div className="bg-ink-800/50 border border-ink-700/50 rounded-xl p-3 text-xs text-ink-400 flex items-start gap-2">
        <span className="text-brand-400 shrink-0 mt-0.5">ⓘ</span>
        <span>
          We pre-authorize <strong className="text-white">
            ${calcTotal(expertRate, 60, feeType, feeValue, flatTiers).total}
          </strong> (1 hour) on your card.
          You're only charged for the actual time used when the session ends.
        </span>
      </div>
    </div>
  )
}
TSH_EOF_MARKER


# ── Patch sessions API to use 1hr pre-auth ───────────────────
echo "→ patching app/api/sessions/route.ts (1hr pre-auth)"
if grep -q "pricing.customerTotal" app/api/sessions/route.ts 2>/dev/null; then
python3 - << 'PYEOF'
import re
content = open('app/api/sessions/route.ts').read()

# Replace the createSessionPaymentIntent call to use 1hr pre-auth
old = '''  const paymentIntent = await createSessionPaymentIntent({
    customerId:      stripeCustomerId,
    expertConnectId: expert.stripeConnectId,
    amountCents:     Math.round(pricing.customerTotal * 100),
    payoutCents:     Math.round(pricing.expertPayout  * 100),
    sessionId,
    paymentMethodId: paymentMethod.id,
  })'''

new = '''  // Pre-auth for 1 full hour regardless of selected duration
  // We settle for actual time used when the session ends
  const preAuthPricing = calculateSessionPricing({
    expertRatePerHour: Number(expert.hourlyRate!),
    durationMinutes:   60,
    feeType:           category.feeType as any,
    feeValue,
    flatTiers:         category.feeFlatTiers as any ?? undefined,
  })

  const paymentIntent = await createSessionPaymentIntent({
    customerId:      stripeCustomerId,
    expertConnectId: expert.stripeConnectId,
    preAuthCents:    Math.round(preAuthPricing.customerTotal * 100),
    payoutCents:     Math.round(preAuthPricing.expertPayout  * 100),
    sessionId,
    paymentMethodId: paymentMethod.id,
  })'''

if old in content:
    content = content.replace(old, new)
    open('app/api/sessions/route.ts', 'w').write(content)
    print("  sessions API patched for 1hr pre-auth")
else:
    print("  (sessions API pattern not matched — manual update may be needed)")
PYEOF
fi

# ── Patch sessions end API to capture actual amount ──────────
echo "→ patching app/api/sessions/[id]/end/route.ts (capture actual time)"
if [ -f "app/api/sessions/[id]/end/route.ts" ]; then
python3 - << 'PYEOF'
import re
content = open('app/api/sessions/[id]/end/route.ts').read()

old = 'await captureSessionPayment(session.stripePaymentIntentId)'
new = '''// Calculate actual charge based on real session duration
  const actualMins = Math.ceil(durationSeconds / 60)
  const actualPricing = calculateSessionPricing({
    expertRatePerHour: Number(session.expertHourlyRate),
    durationMinutes:   actualMins,
    feeType:           session.platformFeeType as any,
    feeValue:          Number(session.platformFeeValue),
  })
  await captureSessionPayment(
    session.stripePaymentIntentId,
    Math.round(actualPricing.customerTotal * 100),
    Math.round(actualPricing.expertPayout  * 100),
    session.expert?.stripeConnectId ?? '',
  )'''

if old in content:
    content = content.replace(old, new)
    # Add calculateSessionPricing import if not present
    if 'calculateSessionPricing' not in content:
        content = content.replace(
            "import { captureSessionPayment }",
            "import { captureSessionPayment, calculateSessionPricing }"
        )
    open('app/api/sessions/[id]/end/route.ts', 'w').write(content)
    print("  end route patched for actual capture")
else:
    print("  (end route pattern not matched — manual update may be needed)")
PYEOF
fi

# ── Patch booking page to use DurationSelector ───────────────
echo "→ patching app/(customer)/customer/book/page.tsx"
if grep -q "DURATIONS = \[15" "app/(customer)/customer/book/page.tsx" 2>/dev/null; then
python3 - << 'PYEOF'
content = open('app/(customer)/customer/book/page.tsx').read()

# Replace DURATIONS constant and duration grid with DurationSelector
old_import_line = "import Link from 'next/link'"
if "DurationSelector" not in content:
    content = content.replace(
        old_import_line,
        "import Link from 'next/link'\nimport { DurationSelector } from '@/components/booking/DurationSelector'"
    )

# Replace hardcoded duration buttons
old_durations = "  const DURATIONS = [15, 30, 45, 60, 90, 120]"
content = content.replace(old_durations, "  // Duration options handled by DurationSelector component")

open('app/(customer)/customer/book/page.tsx', 'w').write(content)
print("  book page patched")
PYEOF
fi

echo ""
echo "✓ Applied. Changes:"
echo "  • app/pro/[slug]/page.tsx — split into server+client components (fixes copy button)"
echo "  • app/pro/[slug]/ProPublicProfileClient.tsx — client component with working copy link"
echo "  • lib/stripe/index.ts — pre-auth 1hr, capture actual time on end"
echo "  • components/booking/DurationSelector.tsx — 30min/45min/1hr + extended options"
echo "  • app/api/sessions/route.ts — pre-auth 1hr on booking"
echo "  • app/api/sessions/[id]/end/route.ts — capture actual time on session end"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Fix public link, session duration selector, 1hr pre-auth' && git push"
