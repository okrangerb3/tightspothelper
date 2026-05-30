'use client'

import { useState, useEffect } from 'react'

interface Lead {
  id: string; businessName: string; phone: string; address: string
  categoryName: string; status: string; googleRating: number | null
  inviteCode: string; createdAt: string; lastContactedAt: string | null
  clickedAt: string | null; registeredAt: string | null
  outreach: { channel: string; status: string; createdAt: string; error: string | null }[]
}

const STATUS_COLORS: Record<string, string> = {
  discovered: 'bg-ink-800 text-ink-400 border-ink-700',
  contacted:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  clicked:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  registered: 'bg-green-500/10 text-green-400 border-green-500/20',
  declined:   'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function AdminLeadsPage() {
  const [leads, setLeads]     = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats]     = useState({ total: 0, contacted: 0, clicked: 0, registered: 0 })

  useEffect(() => {
    fetch('/api/discover-pros')
      .then(r => r.json())
      .then(data => {
        const l = data.leads ?? []
        setLeads(l)
        setStats({
          total:      l.length,
          contacted:  l.filter((x: Lead) => x.status === 'contacted').length,
          clicked:    l.filter((x: Lead) => x.status === 'clicked').length,
          registered: l.filter((x: Lead) => x.status === 'registered').length,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-ink-800 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Pro recruitment</h1>
        <p className="text-sm text-ink-500 mt-1">Leads discovered from Google Places and invited via SMS</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Discovered', value: stats.total, color: 'text-white' },
          { label: 'SMS sent',   value: stats.contacted, color: 'text-blue-400' },
          { label: 'Link clicked', value: stats.clicked, color: 'text-yellow-400' },
          { label: 'Registered', value: stats.registered, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-ink-500">{s.label}</p>
            <p className={`font-display text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Leads table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-800">
            <tr className="text-left text-xs text-ink-500">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Contacted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/50">
            {leads.map(lead => (
              <tr key={lead.id} className="hover:bg-ink-900/40">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{lead.businessName}</p>
                  <p className="text-[10px] text-ink-600">{lead.address}</p>
                </td>
                <td className="px-4 py-3 text-ink-400 text-xs">{lead.categoryName}</td>
                <td className="px-4 py-3 text-ink-300 font-mono text-xs">{lead.phone}</td>
                <td className="px-4 py-3 text-yellow-400 text-xs">{lead.googleRating ? `★ ${lead.googleRating}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] ?? ''}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-500 text-xs">
                  {lead.lastContactedAt
                    ? new Date(lead.lastContactedAt).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <p className="text-center text-ink-500 text-sm py-12">
            No leads yet. Leads are auto-discovered when customers book in categories with no available experts.
          </p>
        )}
      </div>
    </div>
  )
}
