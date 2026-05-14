'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DisputeControls({ session, dispute }: { session: any; dispute: any }) {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [reason, setReason]     = useState('')
  const [refundAmt, setRefundAmt] = useState('')
  const [open, setOpen]         = useState(false)

  const issueRefund = async (full: boolean) => {
    setLoading(true)
    await fetch(`/api/admin/sessions/${session.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full, amountCents: full ? undefined : Math.round(parseFloat(refundAmt) * 100) }),
    })
    setLoading(false); router.refresh()
  }

  const resolveDispute = async () => {
    if (!dispute) return
    setLoading(true)
    await fetch(`/api/admin/sessions/${session.id}/dispute`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolution: reason }),
    })
    setLoading(false); router.refresh()
  }

  if (session.status === 'completed' || session.status === 'disputed') {
    return (
      <div className="card p-5">
        <p className="text-xs text-ink-500 uppercase tracking-wide mb-3">Admin actions</p>

        {dispute && (
          <div className="surface p-4 rounded-xl mb-4">
            <p className="text-xs font-medium text-orange-400 mb-1">Active dispute</p>
            <p className="text-sm text-ink-300">{dispute.reason}</p>
            <p className="text-xs text-ink-500 mt-1">Status: {dispute.status}</p>
            <div className="mt-3 space-y-2">
              <textarea className="input text-xs min-h-[60px] resize-none" placeholder="Resolution notes…"
                value={reason} onChange={e => setReason(e.target.value)} />
              <button onClick={resolveDispute} disabled={loading || !reason}
                className="btn-primary text-sm py-2 w-full">
                Mark resolved
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button onClick={() => issueRefund(true)} disabled={loading}
            className="w-full text-sm px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
            {loading ? '…' : `Full refund ($${(session.customer_total ?? 0).toFixed(2)})`}
          </button>
          <div className="flex gap-2">
            <input type="number" placeholder="Custom amount" step="0.01" min="0.01"
              max={session.customer_total} className="input text-sm py-2"
              value={refundAmt} onChange={e => setRefundAmt(e.target.value)} />
            <button onClick={() => issueRefund(false)} disabled={loading || !refundAmt}
              className="btn-ghost text-sm py-2 shrink-0 disabled:opacity-50">
              Partial refund
            </button>
          </div>
        </div>
      </div>
    )
  }
  return null
}
