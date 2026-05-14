import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { StatCard } from '@/components/ui/Shell'
import RecordingActions from './RecordingActions'

export default async function AdminRecordings() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const recordings = await prisma.recording.findMany({
    include: { session: { select: { problemTitle: true, customerId: true, expertId: true, customer: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const totalBytes    = recordings.reduce((sum, r) => sum + (r.sizeBytes ?? 0), 0)
  const freeBytes     = recordings.filter(r => r.plan === 'free' && !r.deletedAt).reduce((sum, r) => sum + (r.sizeBytes ?? 0), 0)
  const paidBytes     = recordings.filter(r => r.plan !== 'free').reduce((sum, r) => sum + (r.sizeBytes ?? 0), 0)
  const r2Cost        = totalBytes / 1024 / 1024 / 1024 * 0.015
  const expiringCount = recordings.filter(r => r.plan === 'free' && !r.deletedAt && r.expiresAt &&
    new Date(r.expiresAt) < new Date(Date.now() + 7 * 86400000)).length

  const fmt = (bytes: number) => bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`

  const PLAN_STYLE: Record<string, string> = {
    free:         'bg-ink-800 text-ink-400',
    per_session:  'bg-blue-500/10 text-blue-400',
    subscription: 'bg-purple-500/10 text-purple-400',
  }

  return (
    <div className="p-8 max-w-5xl">
        <h1 className="font-display text-2xl font-bold text-white mb-6">Recording storage</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total stored"    value={fmt(totalBytes)} />
          <StatCard label="Free tier"       value={fmt(freeBytes)}  sub="Auto-deletes after 30d" />
          <StatCard label="Paid storage"    value={fmt(paidBytes)}  accent />
          <StatCard label="Est. R2 cost/mo" value={`$${r2Cost.toFixed(2)}`} />
        </div>

        {expiringCount > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 text-sm text-yellow-300">
            {expiringCount} recording{expiringCount !== 1 ? 's' : ''} expiring within 7 days
          </div>
        )}

        <div className="space-y-2">
          {recordings.map(rec => {
            const daysLeft = rec.expiresAt
              ? Math.ceil((new Date(rec.expiresAt).getTime() - Date.now()) / 86400000)
              : null

            return (
              <div key={rec.id} className={`card p-4 ${rec.deletedAt ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-100 truncate">
                      {rec.session?.problemTitle ?? 'Session'}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {rec.session?.customer?.name ?? '—'}
                      {' · '}{rec.durationSeconds ? `${Math.floor(rec.durationSeconds / 60)}m` : '—'}
                      {' · '}{fmt(rec.sizeBytes ?? 0)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {daysLeft !== null && !rec.deletedAt && (
                      <span className={`text-xs ${daysLeft <= 5 ? 'text-red-400' : daysLeft <= 10 ? 'text-yellow-400' : 'text-ink-500'}`}>
                        {rec.deletedAt ? 'Deleted' : daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                      </span>
                    )}
                    {rec.deletedAt && <span className="text-xs text-ink-600">Deleted</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${PLAN_STYLE[rec.plan]}`}>
                      {rec.plan.replace('_', ' ')}
                    </span>
                    {!rec.deletedAt && <RecordingActions recordingId={rec.id} plan={rec.plan} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
    </div>
  )
}
