'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProActions({
  proId, status, stripeConnectOnboarded, checkrCandidateId, backgroundCheckPassed,
}: {
  proId: string
  status: string
  stripeConnectOnboarded?: boolean | null
  checkrCandidateId?: string | null
  backgroundCheckPassed?: boolean | null
}) {
  const router  = useRouter()
  const [loading, setLoading]           = useState<string | null>(null)
  const [rejectOpen, setRejectOpen]     = useState(false)
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

  const triggerBackgroundCheck = async () => {
    setLoading('bgcheck')
    await fetch(`/api/admin/pros/${proId}/background-check`, { method: 'POST' })
    setLoading(null)
    router.refresh()
  }

  // Checkr status badge text + colour
  const checkrLabel = checkrCandidateId === null || checkrCandidateId === undefined
    ? null
    : backgroundCheckPassed === true
      ? 'BG: passed'
      : backgroundCheckPassed === false
        ? 'BG: failed'
        : 'BG: pending'
  const checkrStyle = backgroundCheckPassed === true
    ? 'bg-green-500/10 text-green-400 border-green-500/20'
    : backgroundCheckPassed === false
      ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : 'bg-ink-800 text-ink-400 border-ink-700'

  return (
    <div className="shrink-0 flex flex-col items-end gap-2">
      {/* Status badges */}
      <div className="flex gap-1.5 flex-wrap justify-end">
        {checkrLabel && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${checkrStyle}`}>
            {checkrLabel}
          </span>
        )}
        {status === 'approved' && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
            stripeConnectOnboarded
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
          }`}>
            {stripeConnectOnboarded ? 'Stripe: connected' : 'Stripe: pending'}
          </span>
        )}
      </div>

      {/* Action buttons */}
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
        <div className="flex gap-2 flex-wrap justify-end">
          {/* Re-trigger background check if none passed yet */}
          {!backgroundCheckPassed && (
            <button onClick={triggerBackgroundCheck} disabled={!!loading}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50">
              {loading === 'bgcheck' ? '…' : checkrCandidateId ? 'Re-run BG check' : 'Run BG check'}
            </button>
          )}
          <button onClick={() => action('suspended')} disabled={!!loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors disabled:opacity-50">
            {loading === 'suspended' ? '…' : 'Suspend'}
          </button>
        </div>
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
