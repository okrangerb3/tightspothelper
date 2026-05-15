'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export default function CustomerProfilePage() {
  const router = useRouter()
  const [form, setForm]     = useState({
    firstName: '', lastName: '', email: '', phone: '', city: '', state: '', zip: '',
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        const u = d.user ?? {}
        const [fn, ...rest] = (u.name ?? '').split(' ')
        setForm({
          firstName: u.firstName ?? fn ?? '',
          lastName:  u.lastName  ?? rest.join(' ') ?? '',
          email:     u.email  ?? '',
          phone:     u.phone  ?? '',
          city:      u.city   ?? '',
          state:     u.state  ?? '',
          zip:       u.zip    ?? '',
        })
        setLoading(false)
      })
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(false)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="p-8 max-w-xl">
      <div className="h-8 bg-ink-800 rounded animate-pulse mb-6 w-48" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-ink-800 rounded animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-xl">
      <h1 className="font-display text-2xl font-bold text-white mb-8">My profile</h1>

      <div className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-400 mb-1.5">First name</label>
            <input value={form.firstName} onChange={set('firstName')}
              className="input w-full" placeholder="Jane" />
          </div>
          <div>
            <label className="block text-xs text-ink-400 mb-1.5">Last name</label>
            <input value={form.lastName} onChange={set('lastName')}
              className="input w-full" placeholder="Smith" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-ink-400 mb-1.5">Email address (username)</label>
          <input value={form.email} disabled
            className="input w-full opacity-50 cursor-not-allowed" />
          <p className="text-[10px] text-ink-600 mt-1">
            Email is your username — contact support to change it
          </p>
        </div>

        <div>
          <label className="block text-xs text-ink-400 mb-1.5">Phone number</label>
          <input value={form.phone} onChange={set('phone')} type="tel"
            className="input w-full" placeholder="+1 (555) 000-0000" />
        </div>

        <div>
          <label className="block text-xs text-ink-400 mb-1.5">City</label>
          <input value={form.city} onChange={set('city')}
            className="input w-full" placeholder="Houston" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-400 mb-1.5">State</label>
            <select value={form.state} onChange={set('state')} className="input w-full">
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-400 mb-1.5">ZIP code</label>
            <input value={form.zip} onChange={set('zip')}
              className="input w-full" placeholder="77001" maxLength={10} />
          </div>
        </div>

        {error   && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">Profile saved ✓</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </div>
  )
}
