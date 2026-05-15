'use client'

import { useState } from 'react'

interface Props { userId: string; userName: string }

export function AdminNotificationControls({ userId, userName }: Props) {
  const [overrideEmail, setOverrideEmail] = useState<boolean | null>(null)
  const [overridePush,  setOverridePush]  = useState<boolean | null>(null)
  const [note, setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    const res  = await fetch(`/api/admin/notifications?userId=${userId}`)
    const data = await res.json()
    if (data.prefs) {
      setOverrideEmail(data.prefs.adminOverrideEmail ?? null)
      setOverridePush(data.prefs.adminOverridePush ?? null)
      setNote(data.prefs.adminNote ?? '')
    }
    setLoaded(true)
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adminOverrideEmail: overrideEmail, adminOverridePush: overridePush, adminNote: note }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!loaded) return (
    <button onClick={load} className="btn-ghost text-xs">
      View notification settings
    </button>
  )

  const OverrideSelect = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) => (
    <select value={value === null ? 'user' : value ? 'force_on' : 'force_off'}
      onChange={e => onChange(e.target.value === 'user' ? null : e.target.value === 'force_on')}
      className="input py-1.5 text-xs w-40">
      <option value="user">User controls</option>
      <option value="force_on">Force ON</option>
      <option value="force_off">Force OFF</option>
    </select>
  )

  return (
    <div className="mt-4 pt-4 border-t border-ink-800 space-y-3">
      <h3 className="text-xs font-bold text-white uppercase tracking-wide">
        Notification overrides for {userName}
      </h3>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label text-[10px]">Email notifications</label>
          <OverrideSelect value={overrideEmail} onChange={setOverrideEmail} />
        </div>
        <div>
          <label className="label text-[10px]">Push notifications</label>
          <OverrideSelect value={overridePush} onChange={setOverridePush} />
        </div>
      </div>

      <div>
        <label className="label text-[10px]">Admin note (internal only)</label>
        <input value={note} onChange={e => setNote(e.target.value)}
          className="input text-xs" placeholder="Reason for override…" />
      </div>

      <button onClick={save} disabled={saving}
        className={`btn-primary text-xs ${saved ? 'bg-green-600' : ''}`}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save overrides'}
      </button>
    </div>
  )
}
