import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  active:    'bg-green-500/10  text-green-400  border-green-500/20',
  completed: 'bg-ink-800       text-ink-400    border-ink-700',
  cancelled: 'bg-red-500/10   text-red-400    border-red-500/20',
  disputed:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export default async function CustomerSessionsPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  const user = session.user

  const sessions = await prisma.session.findMany({
    where: { customerId: user.id },
    include: {
      category: { select: { name: true, icon: true } },
      expert: { select: { name: true } },
      recordings: { select: { id: true, purchaseStatus: true, expiresAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const recMap = Object.fromEntries(sessions.map(s => [s.id, s.recordings?.[0]]))

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">My sessions</h1>
        <Link href="/customer/book" className="btn-primary">New session</Link>
      </div>

      {!sessions.length ? (
        <div className="card p-12 text-center">
          <p className="text-ink-500 mb-4">No sessions yet</p>
          <Link href="/customer/book" className="btn-primary">Book your first session</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const rec       = recMap[s.id]
            const hasRec    = rec && rec.purchaseStatus !== 'deleted'
            const recExpiry = rec?.expiresAt ? new Date(rec.expiresAt) : null
            const daysLeft  = recExpiry ? Math.ceil((recExpiry.getTime() - Date.now()) / 86400000) : null

            return (
              <Link key={s.id} href={
                s.status === 'active' ? `/customer/sessions/${s.id}` : `/customer/sessions/${s.id}/summary`
              } className="card p-5 flex gap-4 hover:border-ink-700 transition-colors group block">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-medium text-ink-100">{s.problemTitle ?? 'Session'}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">
                    {s.category?.name}
                    {s.expert?.name ? ` · ${s.expert.name}` : ''}
                    {s.durationBilledMinutes ? ` · ${s.durationBilledMinutes} min` : ''}
                    {' · '}{new Date(s.createdAt).toLocaleDateString()}
                  </p>
                  {hasRec && daysLeft !== null && daysLeft <= 7 && rec.purchaseStatus === 'free_window' && (
                    <p className="text-xs text-yellow-400 mt-1">
                      Recording expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} —{' '}
                      <span className="underline">keep it</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {s.customerTotal && (
                    <span className="text-sm font-medium text-ink-300">${s.customerTotal?.toFixed(2)}</span>
                  )}
                  {hasRec && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                      🎬 rec
                    </span>
                  )}
                  <span className="text-ink-600 group-hover:text-ink-400 transition-colors">→</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
