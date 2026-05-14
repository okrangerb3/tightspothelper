'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

export default function ExpertProfilePage() {
  const router = useRouter()

  const [form, setForm]       = useState({ bio: '', years: '', certifications: '', hourlyRate: 75, available: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/expert/profile')
      if (!res.ok) return
      const data = await res.json()
      if (data) setForm({
        bio:            data.bio ?? '',
        years:          String(data.yearsExperience ?? ''),
        certifications: (data.certifications ?? []).join(', '),
        hourlyRate:     data.hourlyRate ?? 75,
        available:      data.available ?? true,
      })
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/expert/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio:             form.bio,
        yearsExperience: parseInt(form.years) || 0,
        certifications:  form.certifications.split(',').map(s => s.trim()).filter(Boolean),
        hourlyRate:      form.hourlyRate,
        available:       form.available,
      }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-8 max-w-xl">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Edit profile</h1>

      <div className="card p-6 space-y-5">
        <div>
          <label className="label">Available for new sessions</label>
          <button onClick={() => setForm(f => ({ ...f, available: !f.available }))}
            className={`px-4 py-2 rounded-lg text-sm border transition-all
              ${form.available ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-ink-800 text-ink-500 border-ink-700'}`}>
            {form.available ? '● Available' : '○ Unavailable'}
          </button>
        </div>
        <div>
          <label className="label">Hourly rate · ${form.hourlyRate}/hr</label>
          <input type="range" min={25} max={300} step={5} value={form.hourlyRate}
            onChange={e => setForm(f => ({ ...f, hourlyRate: parseInt(e.target.value) }))} className="w-full" />
          <div className="flex justify-between text-xs text-ink-600 mt-1"><span>$25</span><span>$300</span></div>
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="input min-h-[100px] resize-none" value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
        </div>
        <div>
          <label className="label">Years experience</label>
          <input type="number" className="input" value={form.years}
            onChange={e => setForm(f => ({ ...f, years: e.target.value }))} />
        </div>
        <div>
          <label className="label">Certifications (comma-separated)</label>
          <input className="input" value={form.certifications}
            onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))} />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? '…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
