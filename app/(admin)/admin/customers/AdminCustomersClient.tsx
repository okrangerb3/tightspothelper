'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Customer {
  id: string; name: string | null; email: string; phone: string | null
  createdAt: string; emailVerified: boolean; stripeCustomerId: string | null
  banned: boolean
  customerSessions: { customerTotal: number; status: string }[]
}

interface Props {
  customers: Customer[]; total: number; page: number
  pages: number; q: string; status: string
}

export default function AdminCustomersClient({ customers: initial, total, page, pages, q, status }: Props) {
  const router   = useRouter()
  const [customers, setCustomers] = useState(initial)
  const [loading,   setLoading]   = useState<string | null>(null)
  const [confirm,   setConfirm]   = useState<{ id: string; action: 'disable'|'enable'|'delete'; name: string } | null>(null)
  const [reason,    setReason]    = useState('')
  const [toast,     setToast]     = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const doAction = async () => {
    if (!confirm) return
    setLoading(confirm.id)
    const res  = await fetch(`/api/admin/customers/${confirm.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: confirm.action, reason }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(data.message)
      if (confirm.action === 'delete') {
        setCustomers(cs => cs.filter(c => c.id !== confirm.id))
      } else {
        setCustomers(cs => cs.map(c => c.id === confirm.id
          ? { ...c, banned: confirm.action === 'disable' }
          : c
        ))
      }
    } else {
      showToast(data.error ?? 'Action failed')
    }
    setLoading(null)
    setConfirm(null)
    setReason('')
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-ink-800 border border-ink-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card p-6 max-w-md w-full space-y-4">
            <h3 className="font-display text-lg font-bold text-white">
              {confirm.action === 'delete' ? '⚠️ Delete customer' :
               confirm.action === 'disable' ? 'Disable customer' : 'Re-enable customer'}
            </h3>
            <p className="text-sm text-ink-400">
              {confirm.action === 'delete'
                ? `This will permanently delete ${confirm.name} and cancel all their active sessions. This cannot be undone.`
                : confirm.action === 'disable'
                ? `${confirm.name} will not be able to log in until re-enabled.`
                : `${confirm.name} will be able to log in again.`}
            </p>
            {confirm.action !== 'enable' && (
              <div>
                <label className="label">Reason <span className="text-ink-600">(optional)</span></label>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  className="input" placeholder="Reason for this action…" />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setConfirm(null); setReason('') }}
                className="btn-ghost flex-1">Cancel</button>
              <button onClick={doAction} disabled={!!loading}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${confirm.action === 'delete'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'btn-primary'}`}>
                {loading ? '…' : confirm.action === 'delete' ? 'Delete permanently' :
                 confirm.action === 'disable' ? 'Disable account' : 'Re-enable account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Customers</h1>
        <span className="text-sm text-ink-500">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form className="flex-1">
          <input name="q" defaultValue={q} placeholder="Search name or email…" className="input w-full" />
        </form>
        <div className="flex gap-2">
          {['all', 'active', 'disabled'].map(s => (
            <Link key={s} href={`?status=${s}&q=${q}`}
              className={`px-3 py-2 rounded-lg text-xs capitalize border transition-colors
                ${status === s ? 'bg-brand-500 border-brand-500 text-white' : 'border-ink-700 text-ink-400 hover:border-ink-600'}`}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="border-b border-ink-800">
              <tr className="text-left text-xs text-ink-500">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">Spent</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/50">
              {customers.map(c => {
                const spent = c.customerSessions
                  .filter(s => s.status === 'completed')
                  .reduce((sum, s) => sum + s.customerTotal, 0)
                return (
                  <tr key={c.id} className={`hover:bg-ink-900/40 transition-colors ${c.banned ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <a href={`/admin/customers/detail?id=${c.id}`} className="font-medium text-white hover:text-brand-400 transition-colors">{c.name ?? c.email}</a>
                    </td>
                    <td className="px-4 py-3 text-ink-400 text-xs">
                      <p>{c.email}</p>
                      {c.phone && <p className="text-ink-600">{c.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-ink-300">{c.customerSessions.length}</td>
                    <td className="px-4 py-3 text-brand-400">${spent.toFixed(2)}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border
                        ${c.banned
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : c.emailVerified
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                        {c.banned ? 'disabled' : c.emailVerified ? 'verified' : 'unverified'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {c.banned ? (
                          <button onClick={() => setConfirm({ id: c.id, action: 'enable', name: c.name ?? c.email })}
                            className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                            Enable
                          </button>
                        ) : (
                          <button onClick={() => setConfirm({ id: c.id, action: 'disable', name: c.name ?? c.email })}
                            className="text-xs px-2.5 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors">
                            Disable
                          </button>
                        )}
                        <button onClick={() => setConfirm({ id: c.id, action: 'delete', name: c.name ?? c.email })}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {customers.length === 0 && (
          <p className="text-center text-ink-500 text-sm py-12">No customers found</p>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2 mt-4 justify-end">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`?q=${q}&status=${status}&page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded text-xs
                ${p === page ? 'bg-brand-500 text-white' : 'bg-ink-800 text-ink-400 hover:bg-ink-700'}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
