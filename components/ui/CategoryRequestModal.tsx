'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
}

export default function CategoryRequestModal({ onClose }: Props) {
  const [categoryName, setCategoryName] = useState('')
  const [description,  setDescription]  = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error,   setError]     = useState<string | null>(null)

  const submit = async () => {
    if (!categoryName.trim()) { setError('Please enter a category name'); return }
    setLoading(true); setError(null)

    const res  = await fetch('/api/category-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryName, description }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Failed to submit'); setLoading(false); return }

    setSuccess(true)
    setLoading(false)
    setTimeout(onClose, 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 space-y-4">
        {success ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="font-display text-lg font-bold text-white mb-2">Request submitted!</h2>
            <p className="text-sm text-ink-400">
              We'll review your request and notify matching experts. Thanks for helping us grow!
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Request a category</h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  Don't see what you need? Tell us and we'll find experts for you.
                </p>
              </div>
              <button onClick={onClose} className="text-ink-500 hover:text-ink-300 text-xl leading-none p-1">×</button>
            </div>

            <div>
              <label className="label">What do you need help with?</label>
              <input
                value={categoryName}
                onChange={e => setCategoryName(e.target.value)}
                className="input"
                placeholder="e.g. Pool maintenance, Roofing, Pest control…"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Describe your problem <span className="text-ink-600">(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input min-h-[80px] resize-none"
                placeholder="Give us a few details so we can match you with the right expert…"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submit} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Submitting…' : 'Submit request'}
              </button>
            </div>

            <p className="text-[10px] text-ink-600 text-center">
              We'll alert available experts and add it to our roadmap
            </p>
          </>
        )}
      </div>
    </div>
  )
}
