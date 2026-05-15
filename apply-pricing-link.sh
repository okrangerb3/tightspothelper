#!/usr/bin/env bash
# Fix: remove admin rate controls, add pro public link to expert profile
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

echo "→ writing app/(admin)/admin/categories/CategoryEditor.tsx"
cat > "app/(admin)/admin/categories/CategoryEditor.tsx" << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'

interface Category {
  id: string; name: string; slug: string; feeType: string; feeValue: number
  feeFlatTiers: Record<string, number> | null
  rateMin: number; rateMax: number; active: boolean
}

export default function CategoryEditor({ categories: initial }: { categories: Category[] }) {
  const [cats, setCats] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved,  setSaved]  = useState<string | null>(null)

  const update = (id: string, patch: Partial<Category>) =>
    setCats(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c))

  const save = async (cat: Category) => {
    setSaving(cat.id)
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fee_type:       cat.feeType,
        fee_value:      cat.feeValue,
        fee_flat_tiers: cat.feeFlatTiers,
        active:         cat.active,
      }),
    })
    setSaving(null)
    if (res.ok) { setSaved(cat.id); setTimeout(() => setSaved(null), 2000) }
  }

  const DURATION_TIERS = [15, 30, 45, 60, 75, 90, 105, 120]

  return (
    <div className="space-y-3">
      {cats.map(cat => (
        <div key={cat.id} className={`card p-5 transition-all ${!cat.active ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-base font-bold text-white">{cat.name}</h3>
              <button onClick={() => update(cat.id, { active: !cat.active })}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all
                  ${cat.active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-ink-800 text-ink-500 border-ink-700'}`}>
                {cat.active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <button onClick={() => save(cat)} disabled={saving === cat.id}
              className="btn-primary text-xs py-1.5 px-4">
              {saving === cat.id ? '…' : saved === cat.id ? '✓ Saved' : 'Save'}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Fee type */}
            <div>
              <label className="label">Platform fee type</label>
              <div className="flex gap-2">
                {['percentage', 'flat'].map(t => (
                  <button key={t} onClick={() => update(cat.id, { feeType: t })}
                    className={`flex-1 py-2 rounded-lg text-xs border capitalize transition-all
                      ${cat.feeType === t ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-700 text-ink-400 hover:border-ink-500'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee value (percentage only) */}
            {cat.feeType === 'percentage' && (
              <div>
                <label className="label">Platform cut ({Math.round(cat.feeValue * 100)}%)</label>
                <input type="range" min={0.05} max={0.50} step={0.01} value={cat.feeValue}
                  onChange={e => update(cat.id, { feeValue: parseFloat(e.target.value) })}
                  className="w-full mt-2" />
                <div className="flex justify-between text-[10px] text-ink-600 mt-1"><span>5%</span><span>50%</span></div>
              </div>
            )}

            {/* Flat tier editor */}
            {cat.feeType === 'flat' && (
              <div>
                <label className="label">Platform flat fee by duration</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DURATION_TIERS.map(mins => (
                    <div key={mins}>
                      <p className="text-[10px] text-ink-600 mb-0.5 text-center">{mins}m</p>
                      <input type="number" min={0} max={100} step={0.5}
                        value={cat.feeFlatTiers?.[String(mins)] ?? ''}
                        onChange={e => update(cat.id, {
                          feeFlatTiers: { ...(cat.feeFlatTiers ?? {}), [String(mins)]: parseFloat(e.target.value) || 0 }
                        })}
                        className="input text-center text-xs py-1.5 px-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live pricing preview — pros set their own rate, this shows the platform fee only */}
          {cat.feeType === 'percentage' && (
            <div className="mt-4 surface p-3 rounded-xl">
              <p className="text-[10px] text-ink-500 mb-2">
                Platform fee preview (pros set their own rate)
              </p>
              <div className="flex gap-4 text-xs">
                {[30, 60, 90].map(mins => {
                  const exampleRate = 75
                  const sub = exampleRate * mins / 60
                  const fee = sub * cat.feeValue
                  return (
                    <div key={mins}>
                      <p className="text-ink-500">{mins}m @ $75/hr</p>
                      <p className="text-white">${(sub + fee).toFixed(2)} total</p>
                      <p className="text-brand-400">fee ${fee.toFixed(2)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/(expert)/expert/profile/page.tsx'
cat > 'app/(expert)/expert/profile/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

export default function ExpertProfilePage() {
  const [form, setForm] = useState({
    bio: '', years: '', certifications: '', hourlyRate: 75, available: true,
  })
  const [slug, setSlug]         = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved,  setSaved]      = useState(false)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/expert/profile').then(r => r.json()),
      fetch('/api/pro/slug').then(r => r.json()),
    ]).then(([profile, slugData]) => {
      if (profile) setForm({
        bio:            profile.bio ?? '',
        years:          String(profile.yearsExperience ?? ''),
        certifications: (profile.certifications ?? []).join(', '),
        hourlyRate:     Number(profile.hourlyRate ?? 75),
        available:      profile.available ?? true,
      })
      if (slugData.slug) setSlug(slugData.slug)
      setLoading(false)
    })
  }, [])

  const generateSlug = async () => {
    setGenLoading(true)
    const res  = await fetch('/api/pro/slug', { method: 'POST' })
    const data = await res.json()
    if (data.slug) setSlug(data.slug)
    setGenLoading(false)
  }

  const copyLink = () => {
    if (!slug) return
    navigator.clipboard.writeText(`${BASE_URL}/pro/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8"><div className="h-8 w-48 bg-ink-800 rounded animate-pulse" /></div>

  return (
    <div className="p-8 max-w-xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-white">My profile</h1>

      {/* ── Public link ─────────────────────────────────────── */}
      <div className="card p-5 border-brand-500/20">
        <h2 className="font-display text-sm font-bold text-white mb-1">Your public link</h2>
        <p className="text-xs text-ink-500 mb-4">
          Share this link anywhere — social media, email, business cards — to let customers book directly with you.
        </p>

        {slug ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2">
              <span className="text-xs text-ink-400 shrink-0">{BASE_URL}/pro/</span>
              <span className="text-xs text-white font-medium flex-1">{slug}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={copyLink}
                className={`btn-primary flex-1 text-sm ${copied ? 'bg-green-600' : ''}`}>
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
              <a href={`/pro/${slug}`} target="_blank" rel="noopener noreferrer"
                className="btn-ghost text-sm px-4">
                Preview →
              </a>
            </div>
          </div>
        ) : (
          <button onClick={generateSlug} disabled={genLoading} className="btn-primary w-full">
            {genLoading ? 'Generating…' : 'Generate my public link'}
          </button>
        )}
      </div>

      {/* ── Profile fields ──────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-display text-sm font-bold text-white">Profile details</h2>

        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-300">Available for sessions</span>
          <button onClick={() => setForm(f => ({ ...f, available: !f.available }))}
            className={`relative w-10 h-5 rounded-full transition-colors
              ${form.available ? 'bg-brand-500' : 'bg-ink-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
              ${form.available ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div>
          <label className="label">Hourly rate · ${form.hourlyRate}/hr</label>
          <input type="range" min={25} max={500} step={5} value={form.hourlyRate}
            onChange={e => setForm(f => ({ ...f, hourlyRate: parseInt(e.target.value) }))}
            className="w-full" />
          <div className="flex justify-between text-xs text-ink-600 mt-1">
            <span>$25</span>
            <span className="text-brand-400 font-medium">${form.hourlyRate}/hr</span>
            <span>$500</span>
          </div>
          <p className="text-[10px] text-ink-600 mt-1">You set your own rate — we charge the platform fee on top</p>
        </div>

        <div>
          <label className="label">Bio</label>
          <textarea className="input min-h-[100px] resize-none" value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="Describe your expertise and experience…" />
        </div>

        <div>
          <label className="label">Years experience</label>
          <input type="number" className="input" value={form.years}
            onChange={e => setForm(f => ({ ...f, years: e.target.value }))} />
        </div>

        <div>
          <label className="label">Certifications (comma-separated)</label>
          <input className="input" value={form.certifications}
            onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))}
            placeholder="e.g. Master Plumber License, EPA 608 Certified" />
        </div>

        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? '…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
TSH_EOF_MARKER

echo ""
echo "✓ Done. Now run:"
echo "  git add -A && git commit -m 'Pros control pricing; add public link to expert profile' && git push"
