'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CustomerProfilePage() {
  const supabase = createClient()
  const router   = useRouter()

  const [form, setForm]       = useState({ full_name: '', phone: '' })
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')

      const { data } = await supabase
        .from('profiles').select('full_name, phone').eq('id', user.id).single()
      if (data) setForm({ full_name: data.full_name ?? '', phone: data.phone ?? '' })
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    setSaving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      phone:     form.phone.trim() || null,
    }).eq('id', user.id)

    if (error) { setError(error.message); setSaving(false); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const changePassword = async () => {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    alert('Password reset email sent — check your inbox')
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-xl">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Profile</h1>

      <div className="card p-6 space-y-5 mb-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            placeholder="Your name" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input opacity-60 cursor-not-allowed" value={email} readOnly />
          <p className="text-xs text-ink-600 mt-1">Email cannot be changed here</p>
        </div>
        <div>
          <label className="label">Phone (optional)</label>
          <input className="input" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+1 (555) 000-0000" type="tel" />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? '…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-medium text-white mb-3">Security</h2>
        <button onClick={changePassword} className="btn-ghost w-full text-sm">
          Change password
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <Link href="/customer/payment-methods" className="card p-4 flex items-center justify-between hover:border-ink-700 transition-colors block">
          <div>
            <p className="text-sm font-medium text-ink-200">Payment methods</p>
            <p className="text-xs text-ink-500 mt-0.5">Manage saved cards</p>
          </div>
          <span className="text-ink-600">→</span>
        </Link>
        <Link href="/customer/storage" className="card p-4 flex items-center justify-between hover:border-ink-700 transition-colors block">
          <div>
            <p className="text-sm font-medium text-ink-200">Storage plan</p>
            <p className="text-xs text-ink-500 mt-0.5">Manage recording storage</p>
          </div>
          <span className="text-ink-600">→</span>
        </Link>
      </div>
    </div>
  )
}
