import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export const metadata = { title: 'Financials — TightSpotHelper Admin' }

function fmt(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export default async function AdminFinancials() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const now        = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLast    = new Date(now.getFullYear(), now.getMonth(), 0)

  const [
    allCompleted,
    thisMonth,
    lastMonth,
    recentSessions,
    pendingPayouts,
    topExperts,
  ] = await Promise.all([
    // All-time revenue
    prisma.session.aggregate({
      where:  { status: 'completed' },
      _sum:   { platformFeeAmount: true, customerTotal: true, expertPayout: true },
      _count: { id: true },
    }),
    // This month
    prisma.session.aggregate({
      where: { status: 'completed', createdAt: { gte: startOfMonth } },
      _sum:  { platformFeeAmount: true, customerTotal: true },
    }),
    // Last month
    prisma.session.aggregate({
      where: { status: 'completed', createdAt: { gte: startOfLast, lte: endOfLast } },
      _sum:  { platformFeeAmount: true, customerTotal: true },
    }),
    // Recent completed sessions
    prisma.session.findMany({
      where:   { status: 'completed' },
      include: {
        customer: { select: { name: true } },
        expert:   { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { endedAt: 'desc' },
      take:    15,
    }),
    // Pending payouts (sessions completed but payout not released)
    prisma.session.findMany({
      where:   { status: 'completed', paymentStatus: 'held' },
      include: { expert: { select: { name: true } } },
      orderBy: { endedAt: 'asc' },
      take:    10,
    }),
    // Top earning experts
    prisma.session.groupBy({
      by:     ['expertId'],
      where:  { status: 'completed' },
      _sum:   { expertPayout: true },
      _count: { id: true },
      orderBy: { _sum: { expertPayout: 'desc' } },
      take:   10,
    }),
  ])

  // Fetch expert names for top earners
  const expertIds = topExperts.map(e => e.expertId).filter(Boolean) as string[]
  const expertNames = await prisma.authUser.findMany({
    where:  { id: { in: expertIds } },
    select: { id: true, name: true },
  })
  const nameMap = Object.fromEntries(expertNames.map(e => [e.id, e.name]))

  const allTimePlatformRevenue = Number(allCompleted._sum.platformFeeAmount ?? 0)
  const allTimeGMV             = Number(allCompleted._sum.customerTotal ?? 0)
  const allTimePayouts         = Number(allCompleted._sum.expertPayout ?? 0)
  const thisMonthRevenue       = Number(thisMonth._sum.platformFeeAmount ?? 0)
  const lastMonthRevenue       = Number(lastMonth._sum.platformFeeAmount ?? 0)
  const growth = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
    : null

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <h1 className="font-display text-2xl font-bold text-white">Financials</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'All-time platform revenue', value: fmt(allTimePlatformRevenue), accent: true },
          { label: 'All-time GMV',              value: fmt(allTimeGMV) },
          { label: 'All-time expert payouts',   value: fmt(allTimePayouts) },
          { label: 'Total sessions',            value: allCompleted._count.id.toString() },
        ].map(k => (
          <div key={k.label} className={`card p-5 ${k.accent ? 'border-brand-500/30' : ''}`}>
            <p className="text-xs text-ink-500 mb-1">{k.label}</p>
            <p className={`font-display text-2xl font-bold ${k.accent ? 'text-brand-400' : 'text-white'}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Month comparison */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-display text-sm font-bold text-white mb-4">Monthly revenue</h2>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-ink-500 mb-1">This month</p>
              <p className="text-2xl font-bold text-white">{fmt(thisMonthRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500 mb-1">Last month</p>
              <p className="text-2xl font-bold text-ink-400">{fmt(lastMonthRevenue)}</p>
            </div>
            {growth !== null && (
              <div>
                <p className="text-xs text-ink-500 mb-1">Growth</p>
                <p className={`text-2xl font-bold ${Number(growth) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(growth) >= 0 ? '+' : ''}{growth}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pending payouts */}
        <div className="card p-6">
          <h2 className="font-display text-sm font-bold text-white mb-4">
            Pending payouts
            {pendingPayouts.length > 0 && (
              <span className="ml-2 text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">
                {pendingPayouts.length}
              </span>
            )}
          </h2>
          {pendingPayouts.length === 0 ? (
            <p className="text-sm text-ink-500">All payouts released ✓</p>
          ) : (
            <div className="space-y-2">
              {pendingPayouts.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-300">{s.expert?.name ?? 'Unknown'}</span>
                  <span className="text-brand-400">{fmt(Number(s.expertPayout ?? 0))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top experts by earnings */}
      <div className="card p-6">
        <h2 className="font-display text-sm font-bold text-white mb-4">Top experts by earnings</h2>
        <div className="space-y-2">
          {topExperts.map((e, i) => (
            <div key={e.expertId ?? i} className="flex items-center gap-4">
              <span className="text-xs text-ink-600 w-4">{i + 1}</span>
              <span className="flex-1 text-sm text-ink-200">
                {nameMap[e.expertId ?? ''] ?? 'Unknown'}
              </span>
              <span className="text-xs text-ink-500">{e._count.id} sessions</span>
              <span className="text-sm font-medium text-brand-400">
                {fmt(Number(e._sum.expertPayout ?? 0))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-ink-800">
          <h2 className="font-display text-sm font-bold text-white">Recent transactions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-ink-800">
            <tr className="text-left text-xs text-ink-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer → Expert</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">GMV</th>
              <th className="px-4 py-3 font-medium">Platform fee</th>
              <th className="px-4 py-3 font-medium">Expert payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/50">
            {recentSessions.map(s => (
              <tr key={s.id} className="hover:bg-ink-900/40 transition-colors">
                <td className="px-4 py-3 text-ink-500 text-xs">
                  {s.endedAt ? new Date(s.endedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-ink-300 text-xs">
                  {s.customer?.name ?? '?'} → {s.expert?.name ?? '?'}
                </td>
                <td className="px-4 py-3 text-ink-400 text-xs">{s.category?.name ?? '—'}</td>
                <td className="px-4 py-3 text-white">{fmt(Number(s.customerTotal ?? 0))}</td>
                <td className="px-4 py-3 text-brand-400">{fmt(Number(s.platformFeeAmount ?? 0))}</td>
                <td className="px-4 py-3 text-green-400">{fmt(Number(s.expertPayout ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
