'use client'

import { useState } from 'react'

interface Category {
  id: string; name: string; slug: string; fee_type: string; fee_value: number
  fee_flat_tiers: Record<string, number> | null
  rate_min: number; rate_max: number; active: boolean
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
        fee_type:      cat.fee_type,
        fee_value:     cat.fee_value,
        fee_flat_tiers: cat.fee_flat_tiers,
        rate_min:      cat.rate_min,
        rate_max:      cat.rate_max,
        active:        cat.active,
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
              <label className="label">Fee type</label>
              <div className="flex gap-2">
                {['percentage', 'flat'].map(t => (
                  <button key={t} onClick={() => update(cat.id, { fee_type: t })}
                    className={`flex-1 py-2 rounded-lg text-xs border capitalize transition-all
                      ${cat.fee_type === t ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-700 text-ink-400 hover:border-ink-500'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee value (percentage only) */}
            {cat.fee_type === 'percentage' && (
              <div>
                <label className="label">Percentage ({Math.round(cat.fee_value * 100)}%)</label>
                <input type="range" min={0.05} max={0.50} step={0.01} value={cat.fee_value}
                  onChange={e => update(cat.id, { fee_value: parseFloat(e.target.value) })}
                  className="w-full mt-2" />
                <div className="flex justify-between text-[10px] text-ink-600 mt-1"><span>5%</span><span>50%</span></div>
              </div>
            )}

            {/* Flat tier editor */}
            {cat.fee_type === 'flat' && (
              <div>
                <label className="label">Flat fee by duration</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DURATION_TIERS.map(mins => (
                    <div key={mins}>
                      <p className="text-[10px] text-ink-600 mb-0.5 text-center">{mins}m</p>
                      <input type="number" min={0} max={100} step={0.5}
                        value={cat.fee_flat_tiers?.[String(mins)] ?? ''}
                        onChange={e => update(cat.id, {
                          fee_flat_tiers: { ...(cat.fee_flat_tiers ?? {}), [String(mins)]: parseFloat(e.target.value) || 0 }
                        })}
                        className="input text-center text-xs py-1.5 px-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rate guardrails */}
            <div>
              <label className="label">Min expert rate ($/hr)</label>
              <input type="number" className="input" value={cat.rate_min}
                onChange={e => update(cat.id, { rate_min: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">Max expert rate ($/hr)</label>
              <input type="number" className="input" value={cat.rate_max}
                onChange={e => update(cat.id, { rate_max: parseFloat(e.target.value) })} />
            </div>
          </div>

          {/* Live pricing preview */}
          {cat.fee_type === 'percentage' && (
            <div className="mt-4 surface p-3 rounded-xl">
              <p className="text-[10px] text-ink-500 mb-2">Preview at ${cat.rate_min}/hr</p>
              <div className="flex gap-4 text-xs">
                {[30,60,90].map(mins => {
                  const sub  = cat.rate_min * mins / 60
                  const fee  = sub * cat.fee_value
                  return (
                    <div key={mins}>
                      <p className="text-ink-500">{mins}m</p>
                      <p className="text-white">${(sub + fee).toFixed(2)}</p>
                      <p className="text-ink-600">fee ${fee.toFixed(2)}</p>
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
