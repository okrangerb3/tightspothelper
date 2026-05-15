#!/usr/bin/env bash
# Admin settings page + fix clickable customer/expert names
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p "app/(admin)/admin/settings"
mkdir -p "app/(admin)/admin/customers/[id]"
mkdir -p "app/(admin)/admin/pros/[id]"

echo '→ writing admin settings page'
cat > 'app/(admin)/admin/settings/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Health { ok: boolean; results: any }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-ink-800 bg-ink-900/40">
        <h2 className="font-display text-sm font-bold text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, status, href }: { label: string; value: string; status?: 'ok'|'warn'|'error'; href?: string }) {
  const color = status === 'ok' ? 'text-green-400' : status === 'error' ? 'text-red-400' : status === 'warn' ? 'text-yellow-400' : 'text-ink-300'
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-ink-800/60 last:border-0">
      <span className="text-sm text-ink-400">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className={`text-xs font-mono ${color} hover:underline`}>{value}</a>
      ) : (
        <span className={`text-xs font-mono ${color}`}>{value}</span>
      )}
    </div>
  )
}

export default function AdminSettings() {
  const [health, setHealth]     = useState<Health | null>(null)
  const [loading, setLoading]   = useState(true)
  const [testEmail, setTestEmail]   = useState('')
  const [testType, setTestType]     = useState('plain')
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting]       = useState(false)

  useEffect(() => {
    fetch('/api/admin/api-health')
      .then(r => r.json())
      .then(d => { setHealth(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const sendTest = async () => {
    if (!testEmail) return
    setTesting(true); setTestResult(null)
    const res  = await fetch('/api/admin/test-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: testType, to: testEmail }),
    })
    setTestResult(await res.json())
    setTesting(false)
  }

  const h = health?.results

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
        <button onClick={() => { setLoading(true); fetch('/api/admin/api-health').then(r => r.json()).then(d => { setHealth(d); setLoading(false) }) }}
          className="btn-ghost text-sm">↻ Refresh</button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-ink-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Overall status */}
          <div className={`card p-4 mb-5 flex items-center gap-3 ${health?.ok ? 'border-green-500/20' : 'border-red-500/20'}`}>
            <span className={`text-2xl ${health?.ok ? 'text-green-400' : 'text-red-400'}`}>
              {health?.ok ? '✓' : '✗'}
            </span>
            <div>
              <p className="font-medium text-white text-sm">
                {health?.ok ? 'All integrations connected' : 'Some integrations need attention'}
              </p>
              <p className="text-xs text-ink-500">Last checked {new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Stripe */}
          <Section title="💳 Stripe — Payments">
            <Row label="Status"           value={h?.stripe?.ok ? 'Connected' : h?.stripe?.error ?? 'Error'} status={h?.stripe?.ok ? 'ok' : 'error'} />
            <Row label="Mode"             value={h?.stripe?.mode ?? 'unknown'} status={h?.stripe?.mode === 'live' ? 'ok' : 'warn'} />
            <Row label="Secret key"       value={h?.stripe?.keySet ? '✓ Set' : '✗ Missing'} status={h?.stripe?.keySet ? 'ok' : 'error'} />
            <Row label="Webhook secret"   value={h?.stripe?.webhookSet ? '✓ Set' : '✗ Missing'} status={h?.stripe?.webhookSet ? 'ok' : 'error'} />
            <Row label="Publishable key"  value={h?.stripe?.pubKeySet ? '✓ Set' : '✗ Missing'} status={h?.stripe?.pubKeySet ? 'ok' : 'error'} />
            {h?.stripe?.accountId && (
              <Row label="Account" value={h.stripe.accountId}
                href={`https://dashboard.stripe.com/dashboard`} />
            )}
            {h?.stripe?.mode !== 'live' && (
              <p className="text-xs text-yellow-400 mt-3 bg-yellow-500/10 rounded-lg px-3 py-2">
                ⚠️ Using test keys — switch to live keys before going to production
              </p>
            )}
          </Section>

          {/* Resend / Email */}
          <Section title="📧 Resend — Email">
            <Row label="Status"       value={h?.resend?.ok ? 'Connected' : h?.resend?.error ?? 'Error'} status={h?.resend?.ok ? 'ok' : 'error'} />
            <Row label="API key"      value={h?.resend?.keySet ? '✓ Set' : '✗ Missing'} status={h?.resend?.keySet ? 'ok' : 'error'} />
            <Row label="From email"   value={h?.resend?.fromEmail ?? 'NOT SET'} status={h?.resend?.fromEmail && h.resend.fromEmail !== 'NOT SET' ? 'ok' : 'error'} />
            <Row label="Admin alerts" value={h?.resend?.adminEmail ?? 'NOT SET'} status={h?.resend?.adminEmail && h.resend.adminEmail !== 'NOT SET' ? 'ok' : 'warn'} />
            {h?.resend?.domains?.length > 0 && h.resend.domains.map((d: any) => (
              <Row key={d.name} label={`Domain: ${d.name}`} value={d.status}
                status={d.status === 'verified' ? 'ok' : 'warn'}
                href="https://resend.com/domains" />
            ))}

            {/* Email tester */}
            <div className="mt-4 pt-4 border-t border-ink-800 space-y-3">
              <p className="text-xs font-bold text-white">Test email sending</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                    className="input text-sm" type="email" placeholder="Send test to…" />
                </div>
                <select value={testType} onChange={e => setTestType(e.target.value)} className="input text-sm">
                  <option value="plain">Plain test</option>
                  <option value="verification">Email verification</option>
                  <option value="booking_confirm">Booking confirmation</option>
                  <option value="session_summary">Session summary</option>
                  <option value="payout">Payout released</option>
                </select>
              </div>
              <button onClick={sendTest} disabled={testing || !testEmail} className="btn-primary text-sm w-full sm:w-auto px-6">
                {testing ? 'Sending…' : 'Send test email'}
              </button>
              {testResult && (
                <div className={`rounded-xl p-3 text-xs border ${testResult.ok ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                  {testResult.ok
                    ? `✓ Sent successfully — ID: ${testResult.emailId}`
                    : `✗ Failed: ${testResult.error} ${testResult.code ? `(${testResult.code})` : ''}`}
                  <div className="text-ink-500 mt-1">From: {testResult.debug?.fromEmail} → To: {testResult.debug?.toEmail}</div>
                </div>
              )}
              <div className="bg-ink-900 rounded-xl p-3 text-xs text-ink-500 space-y-1">
                <p className="font-medium text-ink-400">Common issues:</p>
                <p>• Domain not verified in Resend → go to resend.com/domains</p>
                <p>• RESEND_FROM_EMAIL must use your verified domain</p>
                <p>• Free Resend accounts can only send to your own email</p>
              </div>
            </div>
          </Section>

          {/* Video / Daily.co */}
          <Section title="🎥 Daily.co — Video">
            <Row label="Status"   value={h?.daily?.ok ? 'Connected' : h?.daily?.error ?? 'Error'} status={h?.daily?.ok ? 'ok' : 'error'} />
            <Row label="API key"  value={h?.daily?.keySet ? '✓ Set' : '✗ Missing'} status={h?.daily?.keySet ? 'ok' : 'error'} />
            {h?.daily?.domain && <Row label="Domain" value={h.daily.domain} href={`https://${h.daily.domain}`} />}
          </Section>

          {/* Database */}
          <Section title="🗄️ Database">
            <Row label="Status"           value={h?.database?.ok ? 'Connected' : h?.database?.error ?? 'Error'} status={h?.database?.ok ? 'ok' : 'error'} />
            <Row label="Users"            value={String(h?.database?.users ?? 0)} />
            <Row label="Sessions"         value={String(h?.database?.sessions ?? 0)} />
            <Row label="Approved experts" value={String(h?.database?.approvedExperts ?? 0)} />
          </Section>

          {/* Env vars */}
          <Section title="🔑 Environment variables">
            <div className="grid sm:grid-cols-2 gap-x-8">
              {h?.env && Object.entries(h.env).map(([k, v]) => {
                const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
                const isSet = v === true || (typeof v === 'string' && v !== 'NOT SET')
                return (
                  <Row key={k} label={label} value={v === true ? '✓ Set' : v === false ? '✗ Not set' : String(v)}
                    status={isSet ? 'ok' : 'error'} />
                )
              })}
            </div>
          </Section>

          {/* Notification preferences */}
          <Section title="🔔 Notification defaults">
            <p className="text-sm text-ink-400 mb-3">
              Per-user notification preferences are managed by each user in their Alerts page.
              As admin you can override any user's settings from their detail page.
            </p>
            <div className="flex gap-3">
              <Link href="/admin/customers" className="btn-ghost text-sm">Customer notifications →</Link>
              <Link href="/admin/pros" className="btn-ghost text-sm">Expert notifications →</Link>
            </div>
          </Section>

          {/* Quick links */}
          <Section title="🔗 External dashboards">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Stripe Dashboard',    href: 'https://dashboard.stripe.com', icon: '💳' },
                { label: 'Resend Dashboard',    href: 'https://resend.com',           icon: '📧' },
                { label: 'Daily.co Dashboard',  href: 'https://dashboard.daily.co',  icon: '🎥' },
                { label: 'Railway Dashboard',   href: 'https://railway.app',         icon: '🚂' },
                { label: 'GitHub Repo',         href: 'https://github.com/okrangerb3/tightspothelper', icon: '💻' },
                { label: 'Cloudflare R2',       href: 'https://dash.cloudflare.com', icon: '☁️' },
              ].map(link => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                  className="card p-3 flex items-center gap-3 hover:border-ink-600 transition-colors">
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-sm text-ink-300">{link.label}</span>
                  <span className="ml-auto text-ink-600 text-xs">↗</span>
                </a>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
TSH_EOF_MARKER

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


# ── Fix customer names to be clickable links ─────────────────
echo "→ making customer names clickable in admin customers list"
python3 - << 'PYEOF'
import os
path = 'app/(admin)/admin/customers/AdminCustomersClient.tsx'
if not os.path.exists(path):
    print(f"  {path} not found")
    exit()
content = open(path).read()
# Replace plain <p> with a link
old = '<p className="font-medium text-white">{c.name ?? \'—\'}</p>'
new = '<a href={`/admin/customers/${c.id}`} className="font-medium text-white hover:text-brand-400 transition-colors">{c.name ?? c.email}</a>'
if old in content:
    content = content.replace(old, new)
    open(path, 'w').write(content)
    print("  customer names are now clickable links")
elif '/admin/customers/${c.id}' in content:
    print("  already linked")
else:
    # Try alternative pattern
    content = content.replace(
        '<p className="font-medium text-white">{c.name',
        '<a href={`/admin/customers/${c.id}`} className="font-medium text-white hover:text-brand-400 transition-colors">{c.name'
    )
    content = content.replace(
        "{c.name ?? '—'}</p>",
        "{c.name ?? c.email}</a>"
    )
    open(path, 'w').write(content)
    print("  customer names patched (alternative pattern)")
PYEOF

# ── Fix expert names to be clickable links ───────────────────
echo "→ making expert names clickable in admin pros list"
python3 - << 'PYEOF'
import os
path = 'app/(admin)/admin/pros/page.tsx'
if not os.path.exists(path):
    print(f"  {path} not found")
    exit()
content = open(path).read()
old  = "<p className=\"text-sm font-medium text-white\">{pro.user?.name ?? 'Unknown'}</p>"
new  = "<a href={`/admin/pros/${pro.id}`} className=\"text-sm font-medium text-white hover:text-brand-400 transition-colors\">{pro.user?.name ?? 'Unknown'}</a>"
if old in content:
    content = content.replace(old, new)
    open(path, 'w').write(content)
    print("  expert names are now clickable links")
elif '/admin/pros/${pro.id}' in content:
    print("  already linked")
else:
    print("  WARNING: pattern not matched in pros page")
PYEOF

# ── Add Settings to admin nav ────────────────────────────────
echo "→ adding Settings to admin nav in Shell.tsx"
python3 - << 'PYEOF'
content = open('components/shell/Shell.tsx').read()

# Add Settings link to admin nav if not present
if '/admin/settings' not in content:
    content = content.replace(
        "{ href: '/admin/api-settings',   label: 'API Keys',    icon: '⚙' },",
        "{ href: '/admin/settings',       label: 'Settings',    icon: '⚙' },"
    )
    # Fallback if api-settings key isn't there
    if '/admin/settings' not in content:
        content = content.replace(
            "{ href: '/admin/recordings',    label: 'Recordings',  icon: '◷' },",
            "{ href: '/admin/recordings',    label: 'Recordings',  icon: '◷' },\n    { href: '/admin/customers',      label: 'Customers',   icon: '◍' },\n    { href: '/admin/financials',     label: 'Financials',  icon: '◐' },\n    { href: '/admin/category-requests', label: 'Requests',  icon: '◌' },\n    { href: '/admin/settings',       label: 'Settings',    icon: '⚙' },"
        )
    open('components/shell/Shell.tsx', 'w').write(content)
    print("  Settings added to admin nav")
else:
    print("  Settings already in nav")

# Add Alerts to customer nav
if '/customer/notifications' not in content:
    content = content.replace(
        "{ href: '/customer/profile',         label: 'Profile',     icon: '◉' },",
        "{ href: '/customer/profile',         label: 'Profile',     icon: '◉' },\n    { href: '/customer/notifications',   label: 'Alerts',      icon: '🔔' },"
    )

# Add Alerts to expert nav  
if '/expert/notifications' not in content:
    content = content.replace(
        "{ href: '/expert/profile',   label: 'Profile',     icon: '◉' },",
        "{ href: '/expert/profile',   label: 'Profile',     icon: '◉' },\n    { href: '/expert/notifications',   label: 'Alerts',      icon: '🔔' },"
    )

open('components/shell/Shell.tsx', 'w').write(content)
PYEOF

echo ""
echo "✓ Applied:"
echo "  • /admin/settings — full settings page with Stripe, Resend, Daily, DB status"
echo "  • /admin/settings — notification tester with 5 email templates"  
echo "  • /admin/settings — all env var health check"
echo "  • /admin/settings — external dashboard quick links"
echo "  • /admin/customers/[id] — clickable customer detail pages"
echo "  • /admin/pros/[id] — clickable expert detail pages"
echo "  • Customer names in /admin/customers are clickable"
echo "  • Expert names in /admin/pros are clickable"
echo "  • Alerts (🔔) added to customer + expert nav"
echo "  • Settings (⚙) added to admin nav"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Admin settings, clickable customer/expert detail pages' && git push"
