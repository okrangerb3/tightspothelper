'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProActions({ proId, status }: { proId: string; status: string }) {
  const router  = useRouter()
  const [loading, setLoading]       = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const action = async (newStatus: string, extra?: Record<string, string>) => {
    setLoading(newStatus)
    await fetch(`/api/admin/pros/${proId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, ...extra }),
    })
    setLoading(null)
    setRejectOpen(false)
    setRejectReason('')
    router.refresh()
  }

  return (
    <div className="shrink-0">
      {status === 'pending' && !rejectOpen && (
        <div className="flex gap-2">
          <button onClick={() => action('approved')} disabled={!!loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50">
            {loading === 'approved' ? '…' : 'Approve'}
          </button>
          <button onClick={() => setRejectOpen(true)} disabled={!!loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
            Reject
          </button>
        </div>
      )}

      {status === 'pending' && rejectOpen && (
        <div className="flex flex-col gap-2 w-56">
          <textarea
            className="input text-xs min-h-[60px] resize-none"
            placeholder="Reason for rejection (sent to applicant)…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => action('rejected', { rejection_reason: rejectReason })}
              disabled={!!loading || !rejectReason.trim()}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
              {loading === 'rejected' ? '…' : 'Confirm reject'}
            </button>
            <button onClick={() => { setRejectOpen(false); setRejectReason('') }}
              className="text-xs px-3 py-1.5 rounded-lg bg-ink-800 text-ink-400 border border-ink-700 hover:bg-ink-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'approved' && (
        <button onClick={() => action('suspended')} disabled={!!loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors disabled:opacity-50">
          {loading === 'suspended' ? '…' : 'Suspend'}
        </button>
      )}
      {(status === 'rejected' || status === 'suspended') && (
        <button onClick={() => action('approved')} disabled={!!loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50">
          {loading === 'approved' ? '…' : 'Reinstate'}
        </button>
      )}
    </div>
  )
}
