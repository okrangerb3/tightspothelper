'use client'

import { useState, useEffect } from 'react'

interface Prefs {
  emailSessionConfirm:  boolean
  emailSessionReminder: boolean
  emailSessionSummary:  boolean
  emailNewBooking:      boolean
  emailPayoutReleased:  boolean
  emailRecordingReady:  boolean
  emailRecordingExpiry: boolean
  emailMarketing:       boolean
  pushSessionAlert:     boolean
  pushNewBooking:       boolean
  pushEmergencyRequest: boolean
  pushPayoutReleased:   boolean
  adminOverrideEmail:   boolean | null
  adminOverridePush:    boolean | null
}

const EMAIL_SETTINGS = [
  { key: 'emailSessionConfirm',  label: 'Session confirmation',     desc: 'When a session is booked' },
  { key: 'emailSessionReminder', label: 'Session reminders',        desc: '1 hour before your session' },
  { key: 'emailSessionSummary',  label: 'Session summary',          desc: 'Notes, parts, and receipt after each session' },
  { key: 'emailNewBooking',      label: 'New booking (experts)',     desc: 'When a customer books you' },
  { key: 'emailPayoutReleased',  label: 'Payout released',          desc: 'When earnings are sent to your account' },
  { key: 'emailRecordingReady',  label: 'Recording ready',          desc: 'When your session recording is available' },
  { key: 'emailRecordingExpiry', label: 'Recording expiry warning', desc: '5 days before a recording expires' },
  { key: 'emailMarketing',       label: 'Tips & updates',           desc: 'Product news, tips, and promotions' },
] as const

const PUSH_SETTINGS = [
  { key: 'pushSessionAlert',     label: 'Session alerts',     desc: 'Reminders and status changes' },
  { key: 'pushNewBooking',       label: 'New bookings',       desc: 'Customer booked a session with you' },
  { key: 'pushEmergencyRequest', label: 'Emergency requests', desc: 'Urgent after-hours booking requests' },
  { key: 'pushPayoutReleased',   label: 'Payout released',    desc: 'Earnings sent to your account' },
] as const

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0
        ${on ? 'bg-brand-500' : 'bg-ink-700'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
        ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function NotificationsPage() {
  const [prefs, setPrefs]   = useState<Prefs | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => { setPrefs(d); setLoading(false) })
  }, [])

  const toggle = (key: keyof Prefs) => {
    setPrefs(p => p ? { ...p, [key]: !p[key as keyof Prefs] } : p)
  }

  const save = async () => {
    if (!prefs) return
    setSaving(true)
    await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-ink-800 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!prefs) return null

  const emailLocked = prefs.adminOverrideEmail !== null && prefs.adminOverrideEmail !== undefined
  const pushLocked  = prefs.adminOverridePush  !== null && prefs.adminOverridePush  !== undefined

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-white">Notifications</h1>
        <button onClick={save} disabled={saving}
          className={`btn-primary text-sm ${saved ? 'bg-green-600' : ''}`}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Admin override banners */}
      {emailLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 text-xs text-yellow-400">
          ⚠️ Email notifications have been {prefs.adminOverrideEmail ? 'enabled' : 'disabled'} by an administrator.
        </div>
      )}
      {pushLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 text-xs text-yellow-400">
          ⚠️ Push notifications have been {prefs.adminOverridePush ? 'enabled' : 'disabled'} by an administrator.
        </div>
      )}

      {/* Email */}
      <div className="card overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-ink-800 flex items-center gap-3">
          <span className="text-base">📧</span>
          <div>
            <h2 className="text-sm font-bold text-white">Email notifications</h2>
            {emailLocked && <p className="text-[10px] text-ink-500">Managed by admin</p>}
          </div>
        </div>
        <div className="divide-y divide-ink-800/60">
          {EMAIL_SETTINGS.map(s => (
            <div key={s.key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{s.label}</p>
                <p className="text-xs text-ink-500">{s.desc}</p>
              </div>
              <Toggle
                on={emailLocked ? !!prefs.adminOverrideEmail : !!prefs[s.key as keyof Prefs]}
                onChange={() => !emailLocked && toggle(s.key as keyof Prefs)}
                disabled={emailLocked}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Push */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-800 flex items-center gap-3">
          <span className="text-base">🔔</span>
          <div>
            <h2 className="text-sm font-bold text-white">Push &amp; in-app notifications</h2>
            {pushLocked && <p className="text-[10px] text-ink-500">Managed by admin</p>}
          </div>
        </div>
        <div className="divide-y divide-ink-800/60">
          {PUSH_SETTINGS.map(s => (
            <div key={s.key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{s.label}</p>
                <p className="text-xs text-ink-500">{s.desc}</p>
              </div>
              <Toggle
                on={pushLocked ? !!prefs.adminOverridePush : !!prefs[s.key as keyof Prefs]}
                onChange={() => !pushLocked && toggle(s.key as keyof Prefs)}
                disabled={pushLocked}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
