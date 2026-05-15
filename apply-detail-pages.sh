#!/usr/bin/env bash
# Admin customer + expert detail pages
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p "app/(admin)/admin/customers/[id]"
mkdir -p "app/(admin)/admin/pros/[id]"

echo '→ writing app/(admin)/admin/customers/[id]/page.tsx'
cat > 'app/(admin)/admin/customers/[id]/page.tsx' << 'TSH_EOF_MARKER'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import AdminCustomerDetailClient from './AdminCustomerDetailClient'

export default async function AdminCustomerDetail({ params }: { params: { id: string } }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const user = await prisma.authUser.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, phone: true,
      createdAt: true, emailVerified: true, stripeCustomerId: true,
      city: true, state: true, zip: true,
      firstName: true, lastName: true,
    },
  }) as any

  if (!user) notFound()

  const [sessions, notifications] = await Promise.all([
    prisma.session.findMany({
      where:   { customerId: params.id },
      include: {
        expert:   { select: { name: true } },
        category: { select: { name: true } },
        reviews:  { select: { rating: true, comment: true } },
        recording: { select: { id: true, purchaseStatus: true, expiresAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.findMany({
      where:   { userId: params.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    }).catch(() => []),
  ])

  // Serialize for client
  const data = {
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      banned:    (user as any).banned ?? false,
    },
    sessions: sessions.map(s => ({
      id:                  s.id,
      status:              s.status,
      createdAt:           s.createdAt.toISOString(),
      endedAt:             s.endedAt?.toISOString() ?? null,
      expertName:          s.expert?.name ?? null,
      categoryName:        s.category?.name ?? null,
      customerTotal:       Number(s.customerTotal ?? 0),
      platformFeeAmount:   Number(s.platformFeeAmount ?? 0),
      durationBilledMinutes: s.durationBilledMinutes ?? null,
      paymentStatus:       s.paymentStatus,
      problemTitle:        s.problemTitle ?? null,
      expertNotes:         s.expertNotes ?? null,
      partsNeeded:         s.partsNeeded as string[],
      stripePaymentIntentId: s.stripePaymentIntentId ?? null,
      review:              s.reviews[0] ? {
        rating:  s.reviews[0].rating,
        comment: s.reviews[0].comment,
      } : null,
      recording: s.recording ? {
        id:             s.recording.id,
        purchaseStatus: s.recording.purchaseStatus,
        expiresAt:      s.recording.expiresAt?.toISOString() ?? null,
      } : null,
    })),
    notifications: notifications.map((n: any) => ({
      id:        n.id,
      type:      n.type,
      payload:   n.payload,
      createdAt: n.createdAt.toISOString(),
      readAt:    n.readAt?.toISOString() ?? null,
    })),
  }

  return <AdminCustomerDetailClient data={data} />
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/customers/[id]/AdminCustomerDetailClient.tsx'
cat > 'app/(admin)/admin/customers/[id]/AdminCustomerDetailClient.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Session {
  id: string; status: string; createdAt: string; endedAt: string | null
  expertName: string | null; categoryName: string | null
  customerTotal: number; platformFeeAmount: number
  durationBilledMinutes: number | null; paymentStatus: string
  problemTitle: string | null; expertNotes: string | null
  partsNeeded: string[]; stripePaymentIntentId: string | null
  review: { rating: number; comment: string | null } | null
  recording: { id: string; purchaseStatus: string; expiresAt: string | null } | null
}
interface Notification { id: string; type: string; payload: any; createdAt: string; readAt: string | null }
interface User {
  id: string; name: string | null; email: string; phone: string | null
  createdAt: string; emailVerified: boolean; stripeCustomerId: string | null
  city: string | null; state: string | null; zip: string | null
  firstName: string | null; lastName: string | null; banned: boolean
}

const STATUS_COLORS: Record<string, string> = {
  completed:  'bg-green-500/10 text-green-400 border-green-500/20',
  active:     'bg-brand-500/10 text-brand-400 border-brand-500/20',
  pending:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelled:  'bg-red-500/10 text-red-400 border-red-500/20',
  disputed:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export default function AdminCustomerDetailClient({
  data: { user, sessions, notifications },
}: {
  data: { user: User; sessions: Session[]; notifications: Notification[] }
}) {
  const [tab, setTab] = useState<'sessions'|'payments'|'notifications'|'profile'>('sessions')
  const [expanded, setExpanded] = useState<string | null>(null)

  const totalSpent   = sessions.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.customerTotal, 0)
  const totalSessions = sessions.length
  const completedSessions = sessions.filter(s => s.status === 'completed').length

  const TABS = [
    { key: 'sessions',      label: `Sessions (${totalSessions})` },
    { key: 'payments',      label: 'Payments' },
    { key: 'notifications', label: `Alerts (${notifications.length})` },
    { key: 'profile',       label: 'Profile' },
  ] as const

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/admin/customers" className="text-xs text-ink-500 hover:text-ink-300 mb-2 block">
            ← Back to customers
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
            {user.name ?? user.email}
          </h1>
          <p className="text-sm text-ink-400 mt-0.5">{user.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user.banned && (
            <span className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              Disabled
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded-lg border
            ${user.emailVerified ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
            {user.emailVerified ? '✓ Verified' : 'Unverified'}
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-ink-500">Total sessions</p>
          <p className="font-display text-2xl font-bold text-white mt-1">{totalSessions}</p>
          <p className="text-xs text-ink-600">{completedSessions} completed</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-500">Total spent</p>
          <p className="font-display text-2xl font-bold text-brand-400 mt-1">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-500">Member since</p>
          <p className="font-display text-lg font-bold text-white mt-1">
            {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink-800 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors
              ${tab === t.key ? 'border-brand-500 text-white font-medium' : 'border-transparent text-ink-500 hover:text-ink-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SESSIONS TAB */}
      {tab === 'sessions' && (
        <div className="space-y-2">
          {sessions.length === 0 && <p className="text-ink-500 text-sm text-center py-8">No sessions yet</p>}
          {sessions.map(s => (
            <div key={s.id} className="card overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="w-full p-4 text-left hover:bg-ink-800/30 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[s.status] ?? 'bg-ink-800 text-ink-500 border-ink-700'}`}>
                    {s.status}
                  </span>
                  <span className="text-sm font-medium text-white flex-1 truncate">
                    {s.problemTitle ?? 'Session'}
                  </span>
                  <span className="text-sm text-brand-400 shrink-0">${s.customerTotal.toFixed(2)}</span>
                  <span className="text-xs text-ink-500 shrink-0">{new Date(s.createdAt).toLocaleDateString()}</span>
                  <span className="text-ink-600 text-xs">{expanded === s.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === s.id && (
                <div className="px-4 pb-4 border-t border-ink-800/60 pt-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-ink-500 mb-0.5">Expert</p>
                      <p className="text-ink-200">{s.expertName ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-ink-500 mb-0.5">Category</p>
                      <p className="text-ink-200">{s.categoryName ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-ink-500 mb-0.5">Duration</p>
                      <p className="text-ink-200">{s.durationBilledMinutes ? `${s.durationBilledMinutes} min` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-ink-500 mb-0.5">Payment</p>
                      <p className="text-ink-200">{s.paymentStatus}</p>
                    </div>
                  </div>

                  {s.expertNotes && (
                    <div>
                      <p className="text-xs text-ink-500 mb-1">Expert notes</p>
                      <p className="text-xs text-ink-300 bg-ink-900 rounded-lg p-3 leading-relaxed">{s.expertNotes}</p>
                    </div>
                  )}

                  {s.partsNeeded?.length > 0 && (
                    <div>
                      <p className="text-xs text-ink-500 mb-1">Parts needed</p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.partsNeeded.map((p, i) => (
                          <span key={i} className="text-xs bg-ink-800 text-ink-300 px-2 py-0.5 rounded-full">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {s.review && (
                    <div>
                      <p className="text-xs text-ink-500 mb-1">Review left</p>
                      <p className="text-yellow-400 text-sm">{'★'.repeat(s.review.rating)}{'☆'.repeat(5 - s.review.rating)}</p>
                      {s.review.comment && <p className="text-xs text-ink-300 mt-0.5">{s.review.comment}</p>}
                    </div>
                  )}

                  {s.recording && (
                    <div className="flex items-center justify-between bg-ink-900 rounded-lg px-3 py-2">
                      <span className="text-xs text-ink-400">Recording: {s.recording.purchaseStatus}</span>
                      <Link href={`/admin/sessions/${s.id}`} className="text-xs text-brand-400 hover:text-brand-300">
                        View session →
                      </Link>
                    </div>
                  )}

                  {!s.recording && (
                    <div className="flex justify-end">
                      <Link href={`/admin/sessions/${s.id}`} className="text-xs text-brand-400 hover:text-brand-300">
                        View full session →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PAYMENTS TAB */}
      {tab === 'payments' && (
        <div className="space-y-3">
          {user.stripeCustomerId && (
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-500">Stripe customer ID</p>
                <p className="text-sm font-mono text-ink-200 mt-0.5">{user.stripeCustomerId}</p>
              </div>
              <a href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`}
                target="_blank" rel="noopener noreferrer"
                className="btn-ghost text-xs">
                Open in Stripe →
              </a>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-ink-800">
              <h2 className="text-sm font-bold text-white">Payment history</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-ink-800">
                <tr className="text-left text-xs text-ink-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/50">
                {sessions.filter(s => s.customerTotal > 0).map(s => (
                  <tr key={s.id} className="hover:bg-ink-900/40">
                    <td className="px-4 py-3 text-ink-500 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink-300 text-xs truncate max-w-[200px]">{s.problemTitle ?? s.categoryName ?? '—'}</td>
                    <td className="px-4 py-3 text-white">${s.customerTotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-brand-400">${s.platformFeeAmount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] ?? ''}`}>
                        {s.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sessions.filter(s => s.customerTotal > 0).length === 0 && (
              <p className="text-center text-ink-500 text-sm py-8">No payments yet</p>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {tab === 'notifications' && (
        <div className="space-y-2">
          {notifications.length === 0 && <p className="text-ink-500 text-sm text-center py-8">No notifications</p>}
          {notifications.map(n => (
            <div key={n.id} className={`card p-4 ${!n.readAt ? 'border-brand-500/20' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-ink-300">{n.type}</span>
                    {!n.readAt && <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />}
                  </div>
                  {n.payload && typeof n.payload === 'object' && (
                    <p className="text-xs text-ink-500">
                      {(n.payload as any).message ?? JSON.stringify(n.payload).slice(0, 100)}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-ink-600 shrink-0">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PROFILE TAB */}
      {tab === 'profile' && (
        <div className="card p-5 space-y-3">
          {[
            ['First name',  user.firstName],
            ['Last name',   user.lastName],
            ['Email',       user.email],
            ['Phone',       user.phone],
            ['City',        user.city],
            ['State',       user.state],
            ['ZIP',         user.zip],
            ['Member since', new Date(user.createdAt).toLocaleString()],
            ['Email verified', user.emailVerified ? 'Yes' : 'No'],
            ['Stripe ID',   user.stripeCustomerId],
            ['User ID',     user.id],
          ].map(([label, value]) => value ? (
            <div key={label as string} className="flex justify-between py-2 border-b border-ink-800/60 last:border-0 text-sm">
              <span className="text-ink-500">{label}</span>
              <span className="text-ink-200 font-mono text-xs text-right max-w-xs break-all">{value}</span>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/pros/[id]/page.tsx'
cat > 'app/(admin)/admin/pros/[id]/page.tsx' << 'TSH_EOF_MARKER'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import AdminProDetailClient from './AdminProDetailClient'

export default async function AdminProDetail({ params }: { params: { id: string } }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const expert = await prisma.expertProfile.findUnique({
    where:   { id: params.id },
    include: { user: { select: {
      id: true, name: true, email: true, phone: true,
      createdAt: true, emailVerified: true,
      firstName: true, lastName: true,
      city: true, state: true, zip: true,
    }}},
  })

  if (!expert) notFound()

  const [sessions, categories] = await Promise.all([
    prisma.session.findMany({
      where:   { expertId: params.id },
      include: {
        customer: { select: { name: true, email: true } },
        category: { select: { name: true } },
        reviews:  { select: { rating: true, comment: true, reviewerId: true } },
        recording: { select: { id: true, purchaseStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    expert.categoryIds.length
      ? prisma.category.findMany({ where: { id: { in: expert.categoryIds } }, select: { name: true, icon: true } })
      : Promise.resolve([]),
  ])

  const data = {
    expert: {
      id:                      expert.id,
      status:                  expert.status,
      bio:                     expert.bio,
      hourlyRate:              Number(expert.hourlyRate ?? 0),
      available:               expert.available,
      yearsExperience:         expert.yearsExperience,
      certifications:          expert.certifications,
      ratingAvg:               Number(expert.ratingAvg ?? 0),
      ratingCount:             expert.ratingCount,
      sessionCount:            expert.sessionCount,
      stripeConnectId:         expert.stripeConnectId,
      stripeConnectOnboarded:  expert.stripeConnectOnboarded,
      backgroundCheckPassed:   expert.backgroundCheckPassed,
      rejectionReason:         expert.rejectionReason,
      slug:                    (expert as any).slug ?? null,
      specialties:             (expert as any).specialties ?? [],
      emergencyAvailable:      (expert as any).emergencyAvailable ?? false,
      emergencyRate:           Number((expert as any).emergencyRate ?? 0),
      createdAt:               expert.createdAt.toISOString(),
    },
    user: {
      ...expert.user,
      createdAt: expert.user.createdAt.toISOString(),
    },
    sessions: sessions.map(s => ({
      id:                    s.id,
      status:                s.status,
      createdAt:             s.createdAt.toISOString(),
      endedAt:               s.endedAt?.toISOString() ?? null,
      customerName:          s.customer?.name ?? s.customer?.email ?? null,
      categoryName:          s.category?.name ?? null,
      expertPayout:          Number(s.expertPayout ?? 0),
      customerTotal:         Number(s.customerTotal ?? 0),
      durationBilledMinutes: s.durationBilledMinutes ?? null,
      paymentStatus:         s.paymentStatus,
      problemTitle:          s.problemTitle ?? null,
      expertNotes:           s.expertNotes ?? null,
      review:                s.reviews[0] ? { rating: s.reviews[0].rating, comment: s.reviews[0].comment } : null,
      hasRecording:          !!s.recording,
    })),
    categories,
  }

  return <AdminProDetailClient data={data} />
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/pros/[id]/AdminProDetailClient.tsx'
cat > 'app/(admin)/admin/pros/[id]/AdminProDetailClient.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Session {
  id: string; status: string; createdAt: string; endedAt: string | null
  customerName: string | null; categoryName: string | null
  expertPayout: number; customerTotal: number
  durationBilledMinutes: number | null; paymentStatus: string
  problemTitle: string | null; expertNotes: string | null
  review: { rating: number; comment: string | null } | null
  hasRecording: boolean
}

const STATUS_COLORS: Record<string, string> = {
  completed:  'bg-green-500/10 text-green-400 border-green-500/20',
  active:     'bg-brand-500/10 text-brand-400 border-brand-500/20',
  pending:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelled:  'bg-red-500/10 text-red-400 border-red-500/20',
  approved:   'bg-green-500/10 text-green-400 border-green-500/20',
  rejected:   'bg-red-500/10 text-red-400 border-red-500/20',
  suspended:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export default function AdminProDetailClient({ data: { expert, user, sessions, categories } }: {
  data: {
    expert: any; user: any; sessions: Session[]; categories: { name: string; icon?: string | null }[]
  }
}) {
  const [tab, setTab]         = useState<'sessions'|'earnings'|'profile'|'background'>('sessions')
  const [expanded, setExpanded] = useState<string | null>(null)

  const totalEarned    = sessions.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.expertPayout, 0)
  const totalSessions  = sessions.length
  const completedCount = sessions.filter(s => s.status === 'completed').length
  const avgRating      = expert.ratingAvg

  const TABS = [
    { key: 'sessions',    label: `Sessions (${totalSessions})` },
    { key: 'earnings',    label: 'Earnings' },
    { key: 'profile',     label: 'Profile' },
    { key: 'background',  label: 'Verification' },
  ] as const

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/admin/pros" className="text-xs text-ink-500 hover:text-ink-300 mb-2 block">← Back to experts</Link>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{user.name ?? user.email}</h1>
          <p className="text-sm text-ink-400 mt-0.5">{user.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className={`text-xs px-2 py-1 rounded-lg border ${STATUS_COLORS[expert.status] ?? 'bg-ink-800 text-ink-500 border-ink-700'}`}>
            {expert.status}
          </span>
          {expert.available && (
            <span className="text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
              ● Available
            </span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-ink-500">Sessions</p>
          <p className="font-display text-2xl font-bold text-white mt-1">{totalSessions}</p>
          <p className="text-xs text-ink-600">{completedCount} completed</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-500">Total earned</p>
          <p className="font-display text-2xl font-bold text-brand-400 mt-1">${totalEarned.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-500">Rating</p>
          <p className="font-display text-2xl font-bold text-yellow-400 mt-1">
            {avgRating > 0 ? avgRating.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-ink-600">{expert.ratingCount} reviews</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-500">Rate</p>
          <p className="font-display text-2xl font-bold text-white mt-1">${expert.hourlyRate}/hr</p>
          {expert.emergencyAvailable && (
            <p className="text-xs text-yellow-500">🚨 ${expert.emergencyRate}/hr emergency</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink-800 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors
              ${tab === t.key ? 'border-brand-500 text-white font-medium' : 'border-transparent text-ink-500 hover:text-ink-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SESSIONS TAB */}
      {tab === 'sessions' && (
        <div className="space-y-2">
          {sessions.length === 0 && <p className="text-ink-500 text-sm text-center py-8">No sessions yet</p>}
          {sessions.map(s => (
            <div key={s.id} className="card overflow-hidden">
              <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="w-full p-4 text-left hover:bg-ink-800/30 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[s.status] ?? ''}`}>
                    {s.status}
                  </span>
                  <span className="text-sm font-medium text-white flex-1 truncate">
                    {s.problemTitle ?? s.categoryName ?? 'Session'}
                  </span>
                  <span className="text-sm text-green-400 shrink-0">+${s.expertPayout.toFixed(2)}</span>
                  <span className="text-xs text-ink-500 shrink-0">{new Date(s.createdAt).toLocaleDateString()}</span>
                  <span className="text-ink-600 text-xs">{expanded === s.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === s.id && (
                <div className="px-4 pb-4 border-t border-ink-800/60 pt-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-ink-500 mb-0.5">Customer</p>
                      <p className="text-ink-200">{s.customerName ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-ink-500 mb-0.5">Duration</p>
                      <p className="text-ink-200">{s.durationBilledMinutes ? `${s.durationBilledMinutes} min` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-ink-500 mb-0.5">Customer paid</p>
                      <p className="text-ink-200">${s.customerTotal.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-ink-500 mb-0.5">Expert payout</p>
                      <p className="text-green-400">${s.expertPayout.toFixed(2)}</p>
                    </div>
                  </div>

                  {s.expertNotes && (
                    <div>
                      <p className="text-xs text-ink-500 mb-1">Session notes</p>
                      <p className="text-xs text-ink-300 bg-ink-900 rounded-lg p-3">{s.expertNotes}</p>
                    </div>
                  )}

                  {s.review && (
                    <div>
                      <p className="text-xs text-ink-500 mb-1">Customer review</p>
                      <p className="text-yellow-400 text-sm">{'★'.repeat(s.review.rating)}{'☆'.repeat(5 - s.review.rating)}</p>
                      {s.review.comment && <p className="text-xs text-ink-300 mt-0.5">{s.review.comment}</p>}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Link href={`/admin/sessions/${s.id}`} className="text-xs text-brand-400 hover:text-brand-300">
                      View full session →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* EARNINGS TAB */}
      {tab === 'earnings' && (
        <div className="space-y-3">
          {expert.stripeConnectId && (
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-500">Stripe Connect ID</p>
                <p className="text-sm font-mono text-ink-200 mt-0.5">{expert.stripeConnectId}</p>
                <p className="text-xs text-ink-600 mt-0.5">
                  Onboarded: {expert.stripeConnectOnboarded ? '✓ Yes' : '✗ No'}
                </p>
              </div>
              <a href={`https://dashboard.stripe.com/connect/accounts/${expert.stripeConnectId}`}
                target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">
                Open in Stripe →
              </a>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-ink-800">
              <h2 className="text-sm font-bold text-white">Session earnings</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-ink-800">
                <tr className="text-left text-xs text-ink-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Customer paid</th>
                  <th className="px-4 py-3">Payout</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/50">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-ink-900/40">
                    <td className="px-4 py-3 text-ink-500 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink-300 text-xs truncate max-w-[150px]">{s.problemTitle ?? s.categoryName ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-200">${s.customerTotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-green-400">${s.expertPayout.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] ?? ''}`}>
                        {s.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROFILE TAB */}
      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-bold text-white mb-4">Expert details</h2>
            <div className="space-y-2">
              {[
                ['Bio',              expert.bio],
                ['Years experience', expert.yearsExperience?.toString()],
                ['Rate',             `$${expert.hourlyRate}/hr`],
                ['Public slug',      expert.slug ? `/pro/${expert.slug}` : null],
              ].map(([label, value]) => value ? (
                <div key={label as string} className="flex justify-between py-2 border-b border-ink-800/60 last:border-0 text-sm">
                  <span className="text-ink-500">{label}</span>
                  <span className="text-ink-200 text-right max-w-xs text-xs">{value}</span>
                </div>
              ) : null)}
            </div>

            {categories.length > 0 && (
              <div className="mt-4 pt-4 border-t border-ink-800">
                <p className="text-xs text-ink-500 mb-2">Categories</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <span key={c.name} className="text-xs bg-brand-500/10 text-brand-300 border border-brand-500/20 px-2.5 py-1 rounded-full">
                      {c.icon} {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {expert.specialties?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-ink-800">
                <p className="text-xs text-ink-500 mb-2">Specialties</p>
                <div className="flex flex-wrap gap-2">
                  {expert.specialties.map((s: string) => (
                    <span key={s} className="text-xs bg-ink-800 text-ink-300 border border-ink-700 px-2.5 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {expert.certifications?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-ink-800">
                <p className="text-xs text-ink-500 mb-2">Certifications</p>
                <ul className="space-y-1">
                  {expert.certifications.map((c: string) => (
                    <li key={c} className="text-xs text-ink-300 flex items-center gap-2"><span className="text-brand-400">✓</span>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-bold text-white mb-4">Contact info</h2>
            {[
              ['Name',    user.name],
              ['Email',   user.email],
              ['Phone',   user.phone],
              ['City',    user.city],
              ['State',   user.state],
              ['ZIP',     user.zip],
              ['Joined',  new Date(user.createdAt).toLocaleString()],
              ['User ID', user.id],
            ].map(([label, value]) => value ? (
              <div key={label as string} className="flex justify-between py-2 border-b border-ink-800/60 last:border-0 text-sm">
                <span className="text-ink-500">{label}</span>
                <span className="text-ink-200 font-mono text-xs text-right max-w-xs break-all">{value}</span>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* BACKGROUND / VERIFICATION TAB */}
      {tab === 'background' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-bold text-white mb-4">Verification status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-ink-800">
                <span className="text-sm text-ink-300">Background check</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${expert.backgroundCheckPassed ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                  {expert.backgroundCheckPassed ? '✓ Passed' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-ink-800">
                <span className="text-sm text-ink-300">Stripe Connect</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${expert.stripeConnectOnboarded ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                  {expert.stripeConnectOnboarded ? '✓ Onboarded' : 'Not onboarded'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-ink-800">
                <span className="text-sm text-ink-300">Email verified</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${user.emailVerified ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                  {user.emailVerified ? '✓ Verified' : 'Unverified'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-300">Application status</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_COLORS[expert.status] ?? ''}`}>
                  {expert.status}
                </span>
              </div>
            </div>

            {expert.rejectionReason && (
              <div className="mt-4 pt-4 border-t border-ink-800">
                <p className="text-xs text-ink-500 mb-2">Rejection reason</p>
                <p className="text-sm text-red-300 bg-red-500/10 rounded-lg p-3">{expert.rejectionReason}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Link href={`/admin/pros?highlight=${expert.id}`} className="btn-ghost text-sm flex-1 text-center">
              Manage application →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
TSH_EOF_MARKER


# Make customer names clickable in admin customers list
echo "→ making customer names link to detail page"
python3 - << 'PYEOF'
import os
path = 'app/(admin)/admin/customers/AdminCustomersClient.tsx'
if os.path.exists(path):
    content = open(path).read()
    if '/admin/customers/${c.id}' not in content:
        content = content.replace(
            '<p className="font-medium text-white">{c.name ?? \'—\'}</p>',
            '<a href={`/admin/customers/${c.id}`} className="font-medium text-white hover:text-brand-400 transition-colors">{c.name ?? c.email}</a>'
        )
        open(path, 'w').write(content)
        print("  customer names are now clickable")
    else:
        print("  already linked")
else:
    print(f"  {path} not found")
PYEOF

# Make expert names clickable in admin pros list
echo "→ making expert names link to detail page"
python3 - << 'PYEOF'
import os
path = 'app/(admin)/admin/pros/page.tsx'
if os.path.exists(path):
    content = open(path).read()
    if '/admin/pros/${pro.id}' not in content:
        content = content.replace(
            '<p className="text-sm font-medium text-white">{pro.user?.name ?? \'Unknown\'}</p>',
            '<a href={`/admin/pros/${pro.id}`} className="text-sm font-medium text-white hover:text-brand-400 transition-colors">{pro.user?.name ?? \'Unknown\'}</a>'
        )
        open(path, 'w').write(content)
        print("  expert names are now clickable")
    else:
        print("  already linked")
else:
    print(f"  {path} not found")
PYEOF

echo ""
echo "✓ Applied. New pages:"
echo "  • /admin/customers/[id] — 4 tabs: Sessions, Payments, Notifications, Profile"
echo "  • /admin/pros/[id]      — 4 tabs: Sessions, Earnings, Profile, Verification"
echo "  • Customer names in /admin/customers are now clickable"
echo "  • Expert names in /admin/pros are now clickable"
echo ""
echo "Each session is expandable to show: notes, parts, review, recording status"
echo "Payments tab links directly to Stripe dashboard for that customer/expert"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Admin customer + expert detail pages' && git push"
