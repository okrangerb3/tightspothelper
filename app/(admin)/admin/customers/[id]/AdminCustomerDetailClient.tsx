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
