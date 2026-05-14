import Link from 'next/link'
import { prisma } from '@/lib/db'

export default async function AdminSessionsPage({ searchParams }: { searchParams: { status?: string } }) {
  const status = searchParams.status

  const sessions = await prisma.session.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      category: { select: { name: true } },
      customer: { select: { name: true } },
      expert:   { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const STATUSES = ['all','active','pending','completed','disputed','cancelled']
  const STATUS_STYLE: Record<string,string> = {
    pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    active:    'bg-green-500/10  text-green-400  border-green-500/20',
    completed: 'bg-ink-800       text-ink-400    border-ink-700',
    cancelled: 'bg-red-500/10   text-red-400    border-red-500/20',
    disputed:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-white mb-6">All sessions</h1>

      <div className="flex gap-1 border-b border-ink-800 mb-6">
        {STATUSES.map(s => (
          <Link key={s} href={s === 'all' ? '/admin/sessions' : `/admin/sessions?status=${s}`}
            className={`px-4 py-2.5 text-sm capitalize transition-colors border-b-2 -mb-px
              ${(!status && s === 'all') || status === s
                ? 'border-brand-500 text-white font-medium'
                : 'border-transparent text-ink-500 hover:text-ink-300'}`}>
            {s}
          </Link>
        ))}
      </div>

      <div className="space-y-1.5">
        {sessions.map(s => (
          <Link key={s.id} href={`/admin/sessions/${s.id}`}
            className="card p-4 flex items-center gap-4 hover:border-ink-700 transition-colors group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-100 truncate">{s.problemTitle ?? 'Session'}</p>
              <p className="text-xs text-ink-500 mt-0.5">
                {s.customer?.name ?? '—'} → {s.expert?.name ?? 'Unassigned'}
                {' · '}{s.category?.name}
                {s.durationBilledMinutes ? ` · ${s.durationBilledMinutes}m` : ''}
                {' · '}{new Date(s.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {s.platformFeeAmount && <span className="text-xs text-brand-400">${s.platformFeeAmount.toFixed(2)} fee</span>}
              {s.customerTotal     && <span className="text-xs text-ink-400">${s.customerTotal.toFixed(2)} total</span>}
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.status]}`}>{s.status}</span>
              <span className="text-ink-600 group-hover:text-ink-400">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
