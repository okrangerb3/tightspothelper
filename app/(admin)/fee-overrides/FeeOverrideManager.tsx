'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Category { id: string; name: string; fee_type: string; fee_value: number }
interface Override  { id: string; category_id: string; override_value: number; starts_at: string; ends_at: string; category: { name: string } | null }

export default function FeeOverrideManager({
  categories, overrides: initial,
}: { categories: Category[]; overrides: Override[] }) {
  const router = useRouter()
  const [overrides, setOverrides] = useState(initial)
  const [form, setForm] = useState({
    category_id:    '',
    override_value: 0.10,
    starts_at:      new Date().toISOString().slice(0, 16),
    ends_at:        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const selectedCat = categories.find(c => c.id === form.category_id)

  const create = async () => {
    if (!form.category_id) { setError('Select a category'); return }
    setSaving(true); setError(null)

    const res = await fetch('/api/admin/fee-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id:    form.category_id,
        override_value: form.override_value,
        starts_at:      new Date(form.starts_at).toISOString(),
        ends_at:        new Date(form.ends_at).toISOString(),
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); setSaving(false); return }

    router.refresh()
    setSaving(false)
  }

  const remove = async (id: string) => {
    setDeleting(id)
    await fetch(`/api/admin/fee-overrides/${id}`, { method: 'DELETE' })
    setOverrides(o => o.filter(ov => ov.id !== id))
    setDeleting(null)
  }

  const fmt = (v: number, type: string) =>
    type === 'percentage' ? `${Math.round(v * 100)}%` : `$${v}`

  return (
    <div className="space-y-6">
      {/* Create override */}
      <div className="card p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-white">Create override</h2>

        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category_id}
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
            <option value="">Select a category…</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} (current: {fmt(c.fee_value, c.fee_type)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">
            Override fee value {selectedCat?.fee_type === 'percentage'
              ? `(${Math.round(form.override_value * 100)}%)`
              : `($${form.override_value})`}
          </label>
          <input
            type="range"
            min={selectedCat?.fee_type === 'percentage' ? 0 : 0}
            max={selectedCat?.fee_type === 'percentage' ? 0.5 : 50}
            step={selectedCat?.fee_type === 'percentage' ? 0.01 : 0.5}
            value={form.override_value}
            onChange={e => setForm(f => ({ ...f, override_value: parseFloat(e.target.value) }))}
            className="w-full"
          />
          {selectedCat && (
            <div className="flex justify-between text-xs text-ink-600 mt-1">
              <span>0 (free)</span>
              <span>Current: {fmt(selectedCat.fee_value, selectedCat.fee_type)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Starts at</label>
            <input type="datetime-local" className="input text-sm" value={form.starts_at}
              onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
          </div>
          <div>
            <label className="label">Ends at</label>
            <input type="datetime-local" className="input text-sm" value={form.ends_at}
              onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
          </div>
        </div>

        {selectedCat && (
          <div className="surface p-3 rounded-xl text-xs text-ink-400">
            During this period, <strong className="text-white">{selectedCat.name}</strong> sessions
            will use a fee of{' '}
            <strong className="text-brand-400">{fmt(form.override_value, selectedCat.fee_type)}</strong>
            {' '}instead of{' '}
            <strong className="text-ink-300">{fmt(selectedCat.fee_value, selectedCat.fee_type)}</strong>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button onClick={create} disabled={saving || !form.category_id} className="btn-primary w-full">
          {saving ? '…' : 'Create override'}
        </button>
      </div>

      {/* Active overrides */}
      <div>
        <h2 className="font-display text-sm font-bold text-white mb-3">Active &amp; upcoming overrides</h2>
        {overrides.length === 0 ? (
          <div className="card p-8 text-center text-ink-500 text-sm">No active overrides</div>
        ) : (
          <div className="space-y-2">
            {overrides.map(ov => (
              <div key={ov.id} className="card p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">
                    {ov.category?.name ?? '—'}
                    <span className="ml-2 text-brand-400 text-xs">
                      {selectedCat?.fee_type === 'percentage'
                        ? `${Math.round(ov.override_value * 100)}%`
                        : `$${ov.override_value}`} fee
                    </span>
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {new Date(ov.starts_at).toLocaleDateString()} → {new Date(ov.ends_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => remove(ov.id)} disabled={deleting === ov.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  {deleting === ov.id ? '…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
