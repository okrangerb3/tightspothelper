import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export default async function ExpertSessionsPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')

  const sessions = await prisma.session.findMany({
    where:   { expertId: session.user.id },
    include: {
      category: { select: { name: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const STATUS_STYLE: Record<string, string> = {
    pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    active:    'bg-green-500/10  text-green-400  border-green-500/20',
    completed: 'bg-ink-800       text-ink-400    border-ink-700',
    cancelled: 'bg-red-500/10   text-red-400    border-red-500/20',
    disputed:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Sessions</h1>

      {!sessions.length ? (
        <div className="card p-12 text-center text-ink-500 text-sm">
          No sessions yet — once you're approved and customers book you, they'll appear here
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Link key={s.id}
              href={s.status === 'completed' || s.status === 'cancelled' || s.status === 'disputed'
                ? `/expert/sessions/${s.id}/summary`
                : `/expert/sessions/${s.id}`}
              className="card p-4 flex items-center gap-4 hover:border-ink-700 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-100 truncate">{s.problemTitle ?? 'Session'}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {s.customer?.name ?? '—'}
                  {' · '}{s.category?.name}
                  {s.durationBilledMins ? ` · ${s.durationBilledMins} min` : ''}
                  {' · '}{new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {s.expertPayout && (
                  <span className="text-sm font-medium text-green-400">${s.expertPayout.toFixed(2)}</span>
                )}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.status]}`}>
                  {s.status}
                </span>
                <span className="text-ink-600 group-hover:text-ink-400 transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}


  const STATUS_STYLE: Record<string, string> = {
    pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    active:    'bg-green-500/10  text-green-400  border-green-500/20',
    completed: 'bg-ink-800       text-ink-400    border-ink-700',
    cancelled: 'bg-red-500/10   text-red-400    border-red-500/20',
    disputed:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Sessions</h1>

      {!sessions?.length ? (
        <div className="card p-12 text-center text-ink-500 text-sm">
          No sessions yet — once you're approved and customers book you, they'll appear here
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Link key={s.id}
              href={s.status === 'completed' || s.status === 'cancelled' || s.status === 'disputed'
                ? `/expert/sessions/${s.id}/summary`
                : `/expert/sessions/${s.id}`}
              className="card p-4 flex items-center gap-4 hover:border-ink-700 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-100 truncate">{s.problem_title ?? 'Session'}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {(s.customer as any)?.full_name ?? '—'}
                  {' · '}{(s.category as any)?.name}
                  {s.duration_billed_minutes ? ` · ${s.duration_billed_minutes} min` : ''}
                  {' · '}{new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {s.expert_payout && (
                  <span className="text-sm font-medium text-green-400">${(s.expert_payout as number).toFixed(2)}</span>
                )}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.status]}`}>
                  {s.status}
                </span>
                <span className="text-ink-600 group-hover:text-ink-400 transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
