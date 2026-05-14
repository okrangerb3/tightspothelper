'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReviewModerationActions({ review }: { review: any }) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)

  const doAction = async (action: string, flaggedReason?: string) => {
    setLoading(true)
    await fetch(`/api/admin/reviews/${review.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, flagged_reason: flaggedReason }),
    })
    setLoading(false)
    router.refresh()
  }

  const remove = async () => {
    if (!confirm('Permanently delete this review?')) return
    setLoading(true)
    await fetch(`/api/admin/reviews/${review.id}`, { method: 'DELETE' })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2 mt-2">
      {review.flagged ? (
        <button onClick={() => doAction('unflag')} disabled={loading}
          className="text-[10px] px-2 py-1 rounded bg-ink-800 text-ink-400 border border-ink-700 hover:bg-ink-700 transition-colors disabled:opacity-50">
          {loading ? '…' : 'Unflag'}
        </button>
      ) : (
        <button onClick={() => doAction('flag')} disabled={loading}
          className="text-[10px] px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors disabled:opacity-50">
          {loading ? '…' : 'Flag'}
        </button>
      )}
      <button onClick={remove} disabled={loading}
        className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
        {loading ? '…' : 'Remove'}
      </button>
    </div>
  )
}
