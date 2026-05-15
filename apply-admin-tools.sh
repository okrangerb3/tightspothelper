#!/usr/bin/env bash
# Admin tools: customer management, notification testing, API health
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p \
  "app/api/admin/customers/[id]" \
  "app/api/admin/test-notification" \
  "app/api/admin/api-health" \
  "app/(admin)/admin/customers" \
  "app/(admin)/admin/api-settings"

mkdir -p 'app/api/admin/customers/[id]/action'
echo '→ writing app/api/admin/customers/[id]/action/route.ts'
cat > 'app/api/admin/customers/[id]/action/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  const { action, reason } = await req.json()
  const userId = params.id

  const user = await prisma.authUser.findUnique({
    where:  { id: userId },
    select: { id: true, email: true, name: true, role: true, stripeCustomerId: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role === 'admin') return NextResponse.json({ error: 'Cannot modify admin accounts' }, { status: 403 })

  switch (action) {
    case 'disable':
      await prisma.authUser.update({
        where: { id: userId },
        data:  { banned: true, banReason: reason ?? 'Disabled by admin' } as any,
      })
      return NextResponse.json({ ok: true, message: `${user.name ?? user.email} disabled` })

    case 'enable':
      await prisma.authUser.update({
        where: { id: userId },
        data:  { banned: false, banReason: null } as any,
      })
      return NextResponse.json({ ok: true, message: `${user.name ?? user.email} re-enabled` })

    case 'delete':
      // Cancel any active sessions
      await prisma.session.updateMany({
        where:  { customerId: userId, status: { in: ['pending', 'active'] } },
        data:   { status: 'cancelled', cancelledReason: 'Account deleted by admin' },
      })
      // Detach Stripe payment methods if customer exists
      if (user.stripeCustomerId) {
        try {
          const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' })
          await Promise.allSettled(methods.data.map(m => stripe.paymentMethods.detach(m.id)))
          await stripe.customers.del(user.stripeCustomerId)
        } catch (e) { console.error('Stripe cleanup error:', e) }
      }
      await prisma.authUser.delete({ where: { id: userId } })
      return NextResponse.json({ ok: true, message: `${user.name ?? user.email} deleted` })

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
TSH_EOF_MARKER

mkdir -p 'app/api/admin/test-notification'
echo '→ writing app/api/admin/test-notification/route.ts'
cat > 'app/api/admin/test-notification/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'

export async function POST(req: NextRequest) {
  const { error } = await requireRole('admin')
  if (error) return error

  const { type, to } = await req.json()
  if (!to) return NextResponse.json({ error: 'Recipient email required' }, { status: 400 })

  const templates: Record<string, { subject: string; html: string }> = {
    verification: {
      subject: '✅ Test: Email verification',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <h3>Email Verification Test</h3>
        <p>This is a test of the email verification template.</p>
        <a href="#" style="background:#f97c0a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0;">Verify Email →</a>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
    booking_confirm: {
      subject: '✅ Test: Booking confirmation',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <h3>Booking Confirmation Test</h3>
        <p>Your session has been confirmed. Expert: <strong>Jane Smith</strong></p>
        <p>Duration: <strong>1 hour</strong> · Total: <strong>$78.75</strong></p>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
    session_summary: {
      subject: '✅ Test: Session summary',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <h3>Session Summary Test</h3>
        <p>Your session has ended. Duration: <strong>47 minutes</strong></p>
        <p>Total charged: <strong>$61.69</strong></p>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
    payout: {
      subject: '✅ Test: Payout released',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <h3>Payout Released Test</h3>
        <p>Your payout of <strong>$56.25</strong> has been sent to your Stripe account.</p>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
    plain: {
      subject: '✅ Test: Plain email from TightSpotHelper',
      html: `<div style="background:#09090b;padding:40px;font-family:sans-serif;color:#fff;">
        <h2 style="color:#f97c0a;">TightSpotHelper</h2>
        <p>This is a plain test email to verify your Resend configuration is working correctly.</p>
        <p>From: <strong>${FROM}</strong></p>
        <p>API Key configured: <strong>${process.env.RESEND_API_KEY ? 'Yes (re_***)' : 'NO — NOT SET'}</strong></p>
        <p style="color:#666;font-size:12px;">Sent at ${new Date().toISOString()}</p>
      </div>`,
    },
  }

  const template = templates[type] ?? templates.plain

  try {
    const result = await resend.emails.send({
      from:    FROM,
      to:      [to],
      subject: template.subject,
      html:    template.html,
    })

    if (result.error) {
      return NextResponse.json({
        ok:    false,
        error: result.error.message,
        code:  result.error.name,
        debug: {
          apiKeySet:  !!process.env.RESEND_API_KEY,
          fromEmail:  FROM,
          toEmail:    to,
        },
      }, { status: 400 })
    }

    return NextResponse.json({
      ok:      true,
      emailId: result.data?.id,
      message: `Test email sent to ${to}`,
      debug: {
        apiKeySet: !!process.env.RESEND_API_KEY,
        fromEmail: FROM,
        toEmail:   to,
      },
    })
  } catch (err: any) {
    return NextResponse.json({
      ok:    false,
      error: err.message ?? 'Unknown error',
      debug: {
        apiKeySet: !!process.env.RESEND_API_KEY,
        fromEmail: FROM,
        toEmail:   to,
      },
    }, { status: 500 })
  }
}
TSH_EOF_MARKER

mkdir -p 'app/api/admin/api-health'
echo '→ writing app/api/admin/api-health/route.ts'
cat > 'app/api/admin/api-health/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { stripe } from '@/lib/stripe'
import { Resend } from 'resend'
import { prisma } from '@/lib/db'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(_req: NextRequest) {
  const { error } = await requireRole('admin')
  if (error) return error

  const results: Record<string, any> = {}

  // ── Stripe ────────────────────────────────────────────────
  try {
    const account = await stripe.accounts.retrieve()
    results.stripe = {
      ok:          true,
      mode:        process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test',
      accountId:   account.id,
      chargesEnabled: (account as any).charges_enabled ?? true,
      keySet:      !!process.env.STRIPE_SECRET_KEY,
      webhookSet:  !!process.env.STRIPE_WEBHOOK_SECRET,
      pubKeySet:   !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    }
  } catch (err: any) {
    results.stripe = { ok: false, error: err.message, keySet: !!process.env.STRIPE_SECRET_KEY }
  }

  // ── Resend ────────────────────────────────────────────────
  try {
    const domains = await resend.domains.list()
    results.resend = {
      ok:         true,
      keySet:     !!process.env.RESEND_API_KEY,
      fromEmail:  process.env.RESEND_FROM_EMAIL ?? 'NOT SET',
      adminEmail: process.env.ADMIN_EMAIL ?? 'NOT SET',
      domains:    (domains.data as any)?.data?.map((d: any) => ({
        name:   d.name,
        status: d.status,
      })) ?? [],
    }
  } catch (err: any) {
    results.resend = {
      ok:        false,
      error:     err.message,
      keySet:    !!process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL ?? 'NOT SET',
    }
  }

  // ── Database ──────────────────────────────────────────────
  try {
    const [users, sessions, experts] = await Promise.all([
      prisma.authUser.count(),
      prisma.session.count(),
      prisma.expertProfile.count({ where: { status: 'approved' } }),
    ])
    results.database = { ok: true, users, sessions, approvedExperts: experts }
  } catch (err: any) {
    results.database = { ok: false, error: err.message }
  }

  // ── Daily.co ──────────────────────────────────────────────
  try {
    const res = await fetch('https://api.daily.co/v1/', {
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
    })
    const data = await res.json()
    results.daily = {
      ok:     res.ok,
      keySet: !!process.env.DAILY_API_KEY,
      domain: data.domain_name ?? null,
      error:  res.ok ? null : data.error,
    }
  } catch (err: any) {
    results.daily = { ok: false, error: err.message, keySet: !!process.env.DAILY_API_KEY }
  }

  // ── Env vars summary ──────────────────────────────────────
  results.env = {
    betterAuthSecret:   !!process.env.BETTER_AUTH_SECRET,
    betterAuthUrl:      process.env.BETTER_AUTH_URL ?? 'NOT SET',
    nextPublicAppUrl:   process.env.NEXT_PUBLIC_APP_URL ?? 'NOT SET',
    checkrApiKey:       !!process.env.CHECKR_API_KEY,
    r2AccessKey:        !!process.env.R2_ACCESS_KEY_ID,
    r2SecretKey:        !!process.env.R2_SECRET_ACCESS_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    cronSecret:         !!process.env.CRON_SECRET,
    adminEmail:         process.env.ADMIN_EMAIL ?? 'NOT SET',
  }

  const allOk = Object.values(results).every((r: any) => r.ok !== false)
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 })
}
TSH_EOF_MARKER

mkdir -p 'app/(admin)/admin/customers'
echo '→ writing app/(admin)/admin/customers/page.tsx'
cat > 'app/(admin)/admin/customers/page.tsx' << 'TSH_EOF_MARKER'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import AdminCustomersClient from './AdminCustomersClient'

export const metadata = { title: 'Customers — TightSpotHelper Admin' }

export default async function AdminCustomers({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; status?: string }
}) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const q      = searchParams.q ?? ''
  const status = searchParams.status ?? 'all'
  const page   = Math.max(1, parseInt(searchParams.page ?? '1'))
  const take   = 25
  const skip   = (page - 1) * take

  const where: any = { role: 'customer' }
  if (q) where.OR = [
    { name:  { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
  ]
  if (status === 'disabled') where.banned = true
  if (status === 'active')   where.banned = { not: true }

  const [customers, total] = await Promise.all([
    prisma.authUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take, skip,
      select: {
        id: true, name: true, email: true, phone: true,
        createdAt: true, emailVerified: true, stripeCustomerId: true,
        customerSessions: { select: { customerTotal: true, status: true } },
      },
    }) as any,
    prisma.authUser.count({ where }),
  ])

  const serialized = customers.map((c: any) => ({
    ...c,
    banned:    (c as any).banned ?? false,
    createdAt: c.createdAt.toISOString(),
    customerSessions: c.customerSessions.map((s: any) => ({
      customerTotal: Number(s.customerTotal ?? 0),
      status: s.status,
    })),
  }))

  return (
    <AdminCustomersClient
      customers={serialized}
      total={total}
      page={page}
      pages={Math.ceil(total / take)}
      q={q}
      status={status}
    />
  )
}
TSH_EOF_MARKER

mkdir -p 'app/(admin)/admin/customers'
echo '→ writing app/(admin)/admin/customers/AdminCustomersClient.tsx'
cat > 'app/(admin)/admin/customers/AdminCustomersClient.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Customer {
  id: string; name: string | null; email: string; phone: string | null
  createdAt: string; emailVerified: boolean; stripeCustomerId: string | null
  banned: boolean
  customerSessions: { customerTotal: number; status: string }[]
}

interface Props {
  customers: Customer[]; total: number; page: number
  pages: number; q: string; status: string
}

export default function AdminCustomersClient({ customers: initial, total, page, pages, q, status }: Props) {
  const router   = useRouter()
  const [customers, setCustomers] = useState(initial)
  const [loading,   setLoading]   = useState<string | null>(null)
  const [confirm,   setConfirm]   = useState<{ id: string; action: 'disable'|'enable'|'delete'; name: string } | null>(null)
  const [reason,    setReason]    = useState('')
  const [toast,     setToast]     = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const doAction = async () => {
    if (!confirm) return
    setLoading(confirm.id)
    const res  = await fetch(`/api/admin/customers/${confirm.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: confirm.action, reason }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(data.message)
      if (confirm.action === 'delete') {
        setCustomers(cs => cs.filter(c => c.id !== confirm.id))
      } else {
        setCustomers(cs => cs.map(c => c.id === confirm.id
          ? { ...c, banned: confirm.action === 'disable' }
          : c
        ))
      }
    } else {
      showToast(data.error ?? 'Action failed')
    }
    setLoading(null)
    setConfirm(null)
    setReason('')
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-ink-800 border border-ink-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card p-6 max-w-md w-full space-y-4">
            <h3 className="font-display text-lg font-bold text-white">
              {confirm.action === 'delete' ? '⚠️ Delete customer' :
               confirm.action === 'disable' ? 'Disable customer' : 'Re-enable customer'}
            </h3>
            <p className="text-sm text-ink-400">
              {confirm.action === 'delete'
                ? `This will permanently delete ${confirm.name} and cancel all their active sessions. This cannot be undone.`
                : confirm.action === 'disable'
                ? `${confirm.name} will not be able to log in until re-enabled.`
                : `${confirm.name} will be able to log in again.`}
            </p>
            {confirm.action !== 'enable' && (
              <div>
                <label className="label">Reason <span className="text-ink-600">(optional)</span></label>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  className="input" placeholder="Reason for this action…" />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setConfirm(null); setReason('') }}
                className="btn-ghost flex-1">Cancel</button>
              <button onClick={doAction} disabled={!!loading}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${confirm.action === 'delete'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'btn-primary'}`}>
                {loading ? '…' : confirm.action === 'delete' ? 'Delete permanently' :
                 confirm.action === 'disable' ? 'Disable account' : 'Re-enable account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Customers</h1>
        <span className="text-sm text-ink-500">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form className="flex-1">
          <input name="q" defaultValue={q} placeholder="Search name or email…" className="input w-full" />
        </form>
        <div className="flex gap-2">
          {['all', 'active', 'disabled'].map(s => (
            <Link key={s} href={`?status=${s}&q=${q}`}
              className={`px-3 py-2 rounded-lg text-xs capitalize border transition-colors
                ${status === s ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-700 text-ink-400 hover:border-ink-600'}`}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="border-b border-ink-800">
              <tr className="text-left text-xs text-ink-500">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">Spent</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/50">
              {customers.map(c => {
                const spent = c.customerSessions
                  .filter(s => s.status === 'completed')
                  .reduce((sum, s) => sum + s.customerTotal, 0)
                return (
                  <tr key={c.id} className={`hover:bg-ink-900/40 transition-colors ${c.banned ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{c.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-400 text-xs">
                      <p>{c.email}</p>
                      {c.phone && <p className="text-ink-600">{c.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-ink-300">{c.customerSessions.length}</td>
                    <td className="px-4 py-3 text-brand-400">${spent.toFixed(2)}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border
                        ${c.banned
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : c.emailVerified
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                        {c.banned ? 'disabled' : c.emailVerified ? 'verified' : 'unverified'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {c.banned ? (
                          <button onClick={() => setConfirm({ id: c.id, action: 'enable', name: c.name ?? c.email })}
                            className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                            Enable
                          </button>
                        ) : (
                          <button onClick={() => setConfirm({ id: c.id, action: 'disable', name: c.name ?? c.email })}
                            className="text-xs px-2.5 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors">
                            Disable
                          </button>
                        )}
                        <button onClick={() => setConfirm({ id: c.id, action: 'delete', name: c.name ?? c.email })}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {customers.length === 0 && (
          <p className="text-center text-ink-500 text-sm py-12">No customers found</p>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2 mt-4 justify-end">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`?q=${q}&status=${status}&page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded text-xs
                ${p === page ? 'bg-brand-500 text-white' : 'bg-ink-800 text-ink-400 hover:bg-ink-700'}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
TSH_EOF_MARKER

mkdir -p 'app/(admin)/admin/api-settings'
echo '→ writing app/(admin)/admin/api-settings/page.tsx'
cat > 'app/(admin)/admin/api-settings/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'

interface HealthResult {
  ok: boolean
  error?: string
  [key: string]: any
}

interface Health {
  ok: boolean
  results: {
    stripe:   HealthResult
    resend:   HealthResult
    database: HealthResult
    daily:    HealthResult
    env:      Record<string, any>
  }
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
      ${ok ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
      {ok ? '✓ Connected' : '✗ Error'}
    </span>
  )
}

function KeyRow({ label, value }: { label: string; value: any }) {
  const isSet     = value === true || (typeof value === 'string' && value !== 'NOT SET' && value !== '')
  const display   = value === true ? '✓ Set' : value === false ? '✗ Not set' : String(value)
  return (
    <div className="flex items-center justify-between py-2 border-b border-ink-800/50 last:border-0">
      <span className="text-xs text-ink-400">{label}</span>
      <span className={`text-xs font-mono ${isSet ? 'text-green-400' : 'text-red-400'}`}>{display}</span>
    </div>
  )
}

export default function ApiSettingsPage() {
  const [health,  setHealth]  = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)

  // Notification test state
  const [testEmail,  setTestEmail]  = useState('')
  const [testType,   setTestType]   = useState('plain')
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const res  = await fetch('/api/admin/api-health')
    const data = await res.json()
    setHealth(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sendTest = async () => {
    if (!testEmail) return
    setTestLoading(true); setTestResult(null)
    const res  = await fetch('/api/admin/test-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: testType, to: testEmail }),
    })
    const data = await res.json()
    setTestResult(data)
    setTestLoading(false)
  }

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-ink-800 rounded-xl animate-pulse" />)}
    </div>
  )

  const h = health!

  return (
    <div className="p-4 sm:p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-white">API & Integrations</h1>
        <button onClick={load} className="btn-ghost text-sm">↻ Refresh</button>
      </div>

      {/* Overall status */}
      <div className={`card p-4 flex items-center gap-3 ${h.ok ? 'border-green-500/20' : 'border-red-500/20'}`}>
        <span className={`text-2xl ${h.ok ? 'text-green-400' : 'text-red-400'}`}>{h.ok ? '✓' : '✗'}</span>
        <div>
          <p className="font-medium text-white text-sm">{h.ok ? 'All systems operational' : 'Some integrations need attention'}</p>
          <p className="text-xs text-ink-500">Last checked {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Stripe */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white">Stripe</h2>
            <StatusBadge ok={h.results.stripe.ok} />
          </div>
          {h.results.stripe.error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3">{h.results.stripe.error}</p>
          )}
          <div className="space-y-0">
            <KeyRow label="Mode"           value={h.results.stripe.mode ?? 'unknown'} />
            <KeyRow label="Secret key"     value={h.results.stripe.keySet} />
            <KeyRow label="Webhook secret" value={h.results.stripe.webhookSet} />
            <KeyRow label="Publishable key" value={h.results.stripe.pubKeySet} />
            {h.results.stripe.accountId && (
              <KeyRow label="Account ID" value={h.results.stripe.accountId} />
            )}
          </div>
          {h.results.stripe.mode === 'test' && (
            <p className="text-[10px] text-yellow-400 mt-3">
              ⚠️ Running in test mode — use live keys for production
            </p>
          )}
        </div>

        {/* Resend */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white">Resend (Email)</h2>
            <StatusBadge ok={h.results.resend.ok} />
          </div>
          {h.results.resend.error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3">{h.results.resend.error}</p>
          )}
          <div className="space-y-0">
            <KeyRow label="API key"     value={h.results.resend.keySet} />
            <KeyRow label="From email"  value={h.results.resend.fromEmail} />
            <KeyRow label="Admin email" value={h.results.resend.adminEmail} />
          </div>
          {h.results.resend.domains?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-ink-800">
              <p className="text-[10px] text-ink-500 mb-2 uppercase tracking-wide">Verified domains</p>
              {h.results.resend.domains.map((d: any) => (
                <div key={d.name} className="flex items-center justify-between text-xs py-1">
                  <span className="text-ink-300 font-mono">{d.name}</span>
                  <span className={d.status === 'verified' ? 'text-green-400' : 'text-yellow-400'}>{d.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Database */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white">Database</h2>
            <StatusBadge ok={h.results.database.ok} />
          </div>
          <div className="space-y-0">
            <KeyRow label="Users"            value={h.results.database.users ?? 0} />
            <KeyRow label="Sessions"         value={h.results.database.sessions ?? 0} />
            <KeyRow label="Approved experts" value={h.results.database.approvedExperts ?? 0} />
          </div>
        </div>

        {/* Daily.co */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-white">Daily.co (Video)</h2>
            <StatusBadge ok={h.results.daily.ok} />
          </div>
          {h.results.daily.error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-3">{h.results.daily.error}</p>
          )}
          <div className="space-y-0">
            <KeyRow label="API key" value={h.results.daily.keySet} />
            {h.results.daily.domain && <KeyRow label="Domain" value={h.results.daily.domain} />}
          </div>
        </div>
      </div>

      {/* Env vars */}
      <div className="card p-5">
        <h2 className="font-display text-sm font-bold text-white mb-4">Environment variables</h2>
        <div className="grid sm:grid-cols-2 gap-x-8">
          {Object.entries(h.results.env).map(([k, v]) => (
            <KeyRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={v} />
          ))}
        </div>
      </div>

      {/* Notification tester */}
      <div className="card p-5">
        <h2 className="font-display text-sm font-bold text-white mb-1">Test notifications</h2>
        <p className="text-xs text-ink-500 mb-4">Send a test email to diagnose Resend issues</p>

        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="label">Send test to</label>
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
              className="input" type="email" placeholder="your@email.com" />
          </div>
          <div>
            <label className="label">Template</label>
            <select value={testType} onChange={e => setTestType(e.target.value)} className="input">
              <option value="plain">Plain test</option>
              <option value="verification">Email verification</option>
              <option value="booking_confirm">Booking confirmation</option>
              <option value="session_summary">Session summary</option>
              <option value="payout">Payout released</option>
            </select>
          </div>
        </div>

        <button onClick={sendTest} disabled={testLoading || !testEmail} className="btn-primary text-sm">
          {testLoading ? 'Sending…' : 'Send test email'}
        </button>

        {testResult && (
          <div className={`mt-4 p-4 rounded-xl text-sm border
            ${testResult.ok ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className={`font-medium mb-2 ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.ok ? '✓ Email sent successfully' : '✗ Failed to send email'}
            </p>
            {testResult.emailId && <p className="text-xs text-ink-400">Email ID: {testResult.emailId}</p>}
            {testResult.error   && <p className="text-xs text-red-300">Error: {testResult.error}</p>}
            {testResult.code    && <p className="text-xs text-red-300">Code: {testResult.code}</p>}
            <div className="mt-2 pt-2 border-t border-white/10 text-xs text-ink-500 space-y-0.5">
              <p>API key set: {testResult.debug?.apiKeySet ? '✓' : '✗ NOT SET'}</p>
              <p>From: {testResult.debug?.fromEmail}</p>
              <p>To: {testResult.debug?.toEmail}</p>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-ink-800">
          <p className="text-[10px] text-ink-500 font-bold uppercase tracking-wide mb-2">Common Resend issues</p>
          <ul className="text-xs text-ink-500 space-y-1">
            <li>• <strong className="text-ink-300">Domain not verified</strong> — go to resend.com/domains and verify your sending domain</li>
            <li>• <strong className="text-ink-300">Wrong FROM address</strong> — RESEND_FROM_EMAIL must use your verified domain</li>
            <li>• <strong className="text-ink-300">API key missing</strong> — add RESEND_API_KEY to Railway environment variables</li>
            <li>• <strong className="text-ink-300">Sandbox mode</strong> — free Resend accounts can only send to your own email</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
TSH_EOF_MARKER


# Add API Settings to admin nav
echo "→ updating admin nav"
if ! grep -q "api-settings" components/shell/Shell.tsx 2>/dev/null; then
  sed -i '' "s|{ href: '/admin/category-requests', label: 'Requests',    icon: '◌' },|{ href: '/admin/category-requests', label: 'Requests',    icon: '◌' },\n    { href: '/admin/api-settings',      label: 'API \& Keys',  icon: '⚙' },|" \
    components/shell/Shell.tsx 2>/dev/null || echo "  (manual nav update may be needed)"
fi

# Add banned/banReason fields to Prisma schema if not present
echo "→ patching prisma schema for banned field"
if ! grep -q '"banned"' prisma/schema.prisma 2>/dev/null; then
python3 - << 'PYEOF'
schema = open('prisma/schema.prisma').read()
schema = schema.replace(
    '  notificationPreferences   NotificationPreferences?',
    '  banned                    Boolean  @default(false)\n  banReason                 String?\n  notificationPreferences   NotificationPreferences?'
)
open('prisma/schema.prisma', 'w').write(schema)
print("  banned field added to AuthUser")
PYEOF
fi

# Migration for banned field
mkdir -p prisma/migrations/20260515000007_user_banned
cat > prisma/migrations/20260515000007_user_banned/migration.sql << 'SQLEOF'
ALTER TABLE "auth_users"
  ADD COLUMN IF NOT EXISTS "banned"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "banReason" TEXT;
SQLEOF

echo ""
echo "✓ Applied. What's new:"
echo "  • /admin/customers — Disable, Enable, Delete buttons with confirm dialog"
echo "  • /api/admin/customers/[id]/action — disable/enable/delete with Stripe cleanup"
echo "  • /admin/api-settings — live health check for Stripe, Resend, DB, Daily.co"
echo "  • /admin/api-settings — notification tester (5 templates) with full debug output"
echo "  • /api/admin/api-health — JSON endpoint for all integration statuses"
echo "  • /api/admin/test-notification — send test emails with debug info"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Admin: customer management, notification tester, API health dashboard' && git push"
