'use client'

import { useState } from 'react'

interface Category {
  id: string
  name: string
  slug: string
  feeType: string
  feeValue: number
  feeFlatTiers: Record<string, number> | null
  active: boolean
  icon?: string | null
  description?: string | null
}

const DURATION_TIERS = [15, 30, 45, 60, 75, 90, 105, 120]

const ICONS = [
  { value: 'ti-droplet',    label: '💧 Plumbing' },
  { value: 'ti-bolt',       label: '⚡ Electrical' },
  { value: 'ti-wind',       label: '❄️ HVAC' },
  { value: 'ti-tool',       label: '🔧 Appliances' },
  { value: 'ti-hammer',     label: '🔨 Handyman' },
  { value: 'ti-car',        label: '🚗 Automotive' },
  { value: 'ti-washing-machine', label: '🧺 Laundry' },
  { value: 'ti-plant',      label: '🌿 Landscaping' },
  { value: 'ti-home',       label: '🏠 General' },
  { value: 'ti-fish',       label: '⛵ Marine' },
]

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function CategoryEditor({ categories: initial }: { categories: Category[] }) {
  const [cats, setCats]     = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved,  setSaved]  = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCat, setNewCat] = useState({
    name: '', slug: '', description: '', icon: 'ti-home',
    feeType: 'percentage', feeValue: 0.20, active: true,
  })

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
        icon:           cat.icon,
        description:    cat.description,
      }),
    })
    setSaving(null)
    if (res.ok) { setSaved(cat.id); setTimeout(() => setSaved(null), 2000) }
  }

  const create = async () => {
    if (!newCat.name.trim()) return
    setCreating(true)
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        newCat.name.trim(),
        slug:        newCat.slug || slugify(newCat.name),
        description: newCat.description || null,
        icon:        newCat.icon,
        fee_type:    newCat.feeType,
        fee_value:   newCat.feeValue,
        active:      newCat.active,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setCats(cs => [...cs, { ...data.category, feeValue: Number(data.category.feeValue), feeFlatTiers: null }])
      setNewCat({ name: '', slug: '', description: '', icon: 'ti-home', feeType: 'percentage', feeValue: 0.20, active: true })
      setShowNew(false)
    }
    setCreating(false)
  }

  return (
    <div className="space-y-4">

      {/* Add new category button */}
      <div className="flex justify-end">
        <button onClick={() => setShowNew(v => !v)} className="btn-primary text-sm">
          {showNew ? '✕ Cancel' : '+ Add category'}
        </button>
      </div>

      {/* New category form */}
      {showNew && (
        <div className="card p-6 border-brand-500/30 space-y-4">
          <h3 className="font-display text-base font-bold text-white">New category</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input value={newCat.name} className="input"
                placeholder="e.g. Pool & Spa"
                onChange={e => setNewCat(n => ({ ...n, name: e.target.value, slug: slugify(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Slug</label>
              <input value={newCat.slug} className="input"
                placeholder="pool-spa"
                onChange={e => setNewCat(n => ({ ...n, slug: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input value={newCat.description} className="input"
              placeholder="Short description shown to customers"
              onChange={e => setNewCat(n => ({ ...n, description: e.target.value }))} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Icon</label>
              <select value={newCat.icon} className="input"
                onChange={e => setNewCat(n => ({ ...n, icon: e.target.value }))}>
                {ICONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Platform fee type</label>
              <div className="flex gap-2 mt-1.5">
                {['percentage', 'flat'].map(t => (
                  <button key={t} onClick={() => setNewCat(n => ({ ...n, feeType: t }))}
                    className={`flex-1 py-2 rounded-lg text-xs border capitalize transition-all
                      ${newCat.feeType === t ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-700 text-ink-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {newCat.feeType === 'percentage' && (
            <div>
              <label className="label">Platform cut — {Math.round(newCat.feeValue * 100)}%</label>
              <input type="range" min={0.05} max={0.50} step={0.01} value={newCat.feeValue}
                onChange={e => setNewCat(n => ({ ...n, feeValue: parseFloat(e.target.value) }))}
                className="w-full" />
              <div className="flex justify-between text-[10px] text-ink-600 mt-1"><span>5%</span><span>50%</span></div>
            </div>
          )}

          <button onClick={create} disabled={creating || !newCat.name.trim()}
            className="btn-primary w-full">
            {creating ? 'Creating…' : 'Create category'}
          </button>
        </div>
      )}

      {/* Existing categories */}
      {cats.map(cat => (
        <div key={cat.id} className={`card p-5 transition-all ${!cat.active ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {cat.icon && <i className={`${cat.icon} text-brand-400`} />}
              <h3 className="font-display text-base font-bold text-white">{cat.name}</h3>
              <button onClick={() => update(cat.id, { active: !cat.active })}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all
                  ${cat.active
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-ink-800 text-ink-500 border-ink-700'}`}>
                {cat.active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <button onClick={() => save(cat)} disabled={saving === cat.id}
              className="btn-primary text-xs py-1.5 px-4">
              {saving === cat.id ? '…' : saved === cat.id ? '✓ Saved' : 'Save'}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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

            {cat.feeType === 'percentage' && (
              <div>
                <label className="label">Platform cut — {Math.round(cat.feeValue * 100)}%</label>
                <input type="range" min={0.05} max={0.50} step={0.01} value={cat.feeValue}
                  onChange={e => update(cat.id, { feeValue: parseFloat(e.target.value) })}
                  className="w-full mt-2" />
                <div className="flex justify-between text-[10px] text-ink-600 mt-1"><span>5%</span><span>50%</span></div>
              </div>
            )}

            {cat.feeType === 'flat' && (
              <div>
                <label className="label">Flat fee by duration</label>
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

          {cat.feeType === 'percentage' && (
            <div className="mt-4 surface p-3 rounded-xl">
              <p className="text-[10px] text-ink-500 mb-2">Fee preview (example $75/hr pro rate)</p>
              <div className="flex gap-4 text-xs">
                {[30, 60, 90].map(mins => {
                  const sub = 75 * mins / 60
                  const fee = sub * cat.feeValue
                  return (
                    <div key={mins}>
                      <p className="text-ink-500">{mins}m</p>
                      <p className="text-white">${(sub + fee).toFixed(2)}</p>
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
