import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { StatCard } from '@/components/ui/Shell'

export default async function ExpertEarningsPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  const userId = session.user.id

  const [sessions, expert] = await Promise.all([
    prisma.session.findMany({
      where:   { expertId: userId, status: 'completed' },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expertProfile.findUnique({
      where:  { id: userId },
      select: { stripeConnectId: true, stripeConnectOnboarded: true, hourlyRate: true },
    }),
  ])

  const totalEarned   = sessions.reduce((s, r) => s + Number(r.expertPayout ?? 0), 0)
  const thisMonth     = sessions.filter(s => {
    const d = new Date(s.createdAt); const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).reduce((s, r) => s + Number(r.expertPayout ?? 0), 0)
  const avgPerSession = sessions.length ? totalEarned / sessions.length : 0

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Earnings</h1>

      {!expert?.stripeConnectOnboarded && (
        <div className="card p-5 mb-6 border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm font-medium text-yellow-300 mb-1">Payout account not connected</p>
          <p className="text-xs text-ink-400 mb-3">Connect your bank account via Stripe to receive payouts</p>
          <a href="/expert/apply/connect" className="btn-primary text-sm py-2">Connect payout account</a>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <StatCard label="Total earned"    value={`$${totalEarned.toFixed(2)}`} accent />
        <StatCard label="This month"      value={`$${thisMonth.toFixed(2)}`} />
        <StatCard label="Avg per session" value={`$${avgPerSession.toFixed(2)}`} />
      </div>

      <h2 className="font-display text-sm font-bold text-white mb-3">Completed sessions</h2>
      {!sessions.length ? (
        <div className="card p-8 text-center text-ink-500 text-sm">No completed sessions yet</div>
      ) : (
        <div className="card divide-y divide-ink-800">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-ink-200">{s.category?.name ?? 'Session'}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString()}
                  {s.durationBilledMinutes ? ` · ${s.durationBilledMinutes} min` : ''}
                </p>
              </div>
              <span className="text-sm font-medium text-green-400">
                ${(s.expertPayout ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

