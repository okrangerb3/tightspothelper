'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProActions({ proId, status }: { proId: string; status: string }) {
  const router  = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const action = async (newStatus: string) => {
    setLoading(newStatus)
    await fetch(`/api/admin/pros/${proId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex gap-2 shrink-0">
      {status === 'pending' && (
        <>
          <button onClick={() => action('approved')} disabled={!!loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50">
            {loading === 'approved' ? '…' : 'Approve'}
          </button>
          <button onClick={() => action('rejected')} disabled={!!loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
            {loading === 'rejected' ? '…' : 'Reject'}
          </button>
        </>
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
