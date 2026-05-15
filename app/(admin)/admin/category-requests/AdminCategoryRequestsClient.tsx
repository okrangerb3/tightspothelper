'use client'

import { useState } from 'react'

interface Request {
  id: string; categoryName: string; description: string | null
  status: string; adminNote: string | null; createdAt: string
  user: { name: string | null; email: string }
}

export default function AdminCategoryRequestsClient({ requests: initial }: { requests: Request[] }) {
  const [requests, setRequests] = useState(initial)
  const [loading, setLoading]   = useState<string | null>(null)

  const update = async (id: string, status: string, adminNote?: string) => {
    setLoading(id)
    await fetch('/api/category-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, adminNote }),
    })
    setRequests(rs => rs.map(r => r.id === id ? { ...r, status, adminNote: adminNote ?? r.adminNote } : r))
    setLoading(null)
  }

  const STATUS_COLORS: Record<string, string> = {
    pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    approved:  'bg-green-500/10 text-green-400 border-green-500/20',
    dismissed: 'bg-ink-800 text-ink-500 border-ink-700',
  }

  return (
    <div className="space-y-3">
      {requests.length === 0 && (
        <p className="text-center text-ink-500 text-sm py-12">No category requests yet</p>
      )}
      {requests.map(r => (
        <div key={r.id} className="card p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-display text-base font-bold text-white">{r.categoryName}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status] ?? ''}`}>
                  {r.status}
                </span>
              </div>
              {r.description && <p className="text-sm text-ink-400 mb-2">{r.description}</p>}
              <p className="text-xs text-ink-600">
                {r.user.name ?? r.user.email} · {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>

            {r.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => update(r.id, 'approved')} disabled={loading === r.id}
                  className="btn-primary text-xs py-1.5 px-3">
                  {loading === r.id ? '…' : 'Approve'}
                </button>
                <button onClick={() => update(r.id, 'dismissed')} disabled={loading === r.id}
                  className="btn-ghost text-xs py-1.5 px-3">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
