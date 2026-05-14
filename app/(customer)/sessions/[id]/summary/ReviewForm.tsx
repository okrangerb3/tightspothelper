'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReviewForm({
  sessionId,
  revieweeId,
  label = 'Leave a review',
}: {
  sessionId:  string
  revieweeId: string
  label?:     string
}) {
  const router   = useRouter()
  const [rating,   setRating]   = useState(0)
  const [hover,    setHover]    = useState(0)
  const [comment,  setComment]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [done,     setDone]     = useState(false)

  const submit = async () => {
    if (!rating) { setError('Please select a star rating.'); return }
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/sessions/${sessionId}/review`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ revieweeId, rating, comment }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          {[1,2,3,4,5].map(n => (
            <span key={n} className={`text-xl ${n <= rating ? 'text-brand-400' : 'text-ink-700'}`}>★</span>
          ))}
        </div>
        <p className="text-sm text-ink-300">Thanks for your review!</p>
        {comment && <p className="text-xs text-ink-500 mt-1 italic">"{comment}"</p>}
      </div>
    )
  }

  return (
    <div className="card p-5" id="review">
      <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-4">{label}</h2>

      {/* Star picker */}
      <div className="flex gap-1 mb-4">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="text-3xl transition-colors focus:outline-none"
            aria-label={`${n} star${n !== 1 ? 's' : ''}`}
          >
            <span className={(hover || rating) >= n ? 'text-brand-400' : 'text-ink-700'}>★</span>
          </button>
        ))}
        {rating > 0 && (
          <span className="text-xs text-ink-500 self-center ml-1">
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
          </span>
        )}
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="How did it go? (optional)"
        className="input min-h-[80px] resize-none text-sm mb-3"
      />

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <button
        onClick={submit}
        disabled={loading || !rating}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  )
}
