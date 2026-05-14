import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { StatCard } from '@/components/ui/Shell'

export default async function ExpertDashboard() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  const userId = session.user.id
  if ((session.user as any).role !== 'expert') redirect(`/${(session.user as any).role}/dashboard`)

  const [expert, sessions] = await Promise.all([
    prisma.expertProfile.findUnique({ where: { id: userId } }),
    prisma.session.findMany({
      where:   { expertId: userId },
      include: {
        category: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  if (expert?.status === 'pending') {
    return (
      <div className="p-8 max-w-lg">
          <div className="card p-8 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="font-display text-xl font-bold text-white mb-2">Application under review</h2>
            <p className="text-ink-400 text-sm">We're reviewing your application and running a background check. This usually takes 1–3 business days. We'll email you when it's done.</p>
          </div>
      </div>
    )
  }

  if (expert?.status === 'rejected') {
    return (
      <div className="p-8 max-w-lg">
          <div className="card p-8 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="font-display text-xl font-bold text-white mb-2">Application not approved</h2>
            <p className="text-ink-400 text-sm">Unfortunately we weren't able to approve your application at this time. Contact support for more information.</p>
          </div>
      </div>
    )
  }

  const completed   = sessions.filter(s => s.status === 'completed')
  const totalEarned = completed.reduce((sum, s) => sum + (s.expertPayout ?? 0), 0)
  const active      = sessions.find(s => s.status === 'active')

  return (
    <div className="p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Hey, {session.user.name?.split(' ')[0]} 👋
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${expert?.available ? 'bg-green-400' : 'bg-ink-600'}`} />
              <span className="text-xs text-ink-400">{expert?.available ? 'Available for sessions' : 'Unavailable'}</span>
            </div>
          </div>
          <Link href="/expert/profile" className="btn-ghost text-sm">Edit profile</Link>
        </div>

        {active && (
          <Link href={`/expert/sessions/${active.id}`}
            className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 hover:bg-green-500/15 transition-colors">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-green-300 text-sm font-medium">Active session — tap to rejoin</p>
            <span className="ml-auto text-green-400">→</span>
          </Link>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total sessions"   value={String(expert?.totalSessions ?? 0)} />
          <StatCard label="Total earned"     value={`$${totalEarned.toFixed(2)}`} accent />
          <StatCard label="Rating"           value={expert?.ratingAvg ? `${expert.ratingAvg.toFixed(1)}★` : '—'} sub={`${expert?.ratingCount ?? 0} reviews`} />
          <StatCard label="Rate"             value={`$${expert?.hourlyRate ?? 0}/hr`} />
        </div>

        <h2 className="font-display text-base font-bold text-white mb-4">Recent sessions</h2>
        {!sessions.length ? (
          <div className="card p-8 text-center text-ink-500 text-sm">No sessions yet — your first booking will appear here</div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <Link key={s.id} href={`/expert/sessions/${s.id}`}
                className="card p-4 flex items-center gap-4 hover:border-ink-700 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-100 truncate">{s.problemTitle ?? 'Session'}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {s.customer?.name} · {s.category?.name} · {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.expertPayout && <span className="text-sm font-medium text-green-400">${s.expertPayout.toFixed(2)}</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border
                    ${s.status === 'completed' ? 'bg-ink-800 text-ink-400 border-ink-700' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                    {s.status}
                  </span>
                  <span className="text-ink-600 group-hover:text-ink-400">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}


  if (expert?.status === 'pending') {
    return (
      <div className="p-8 max-w-lg">
          <div className="card p-8 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="font-display text-xl font-bold text-white mb-2">Application under review</h2>
            <p className="text-ink-400 text-sm">We're reviewing your application and running a background check. This usually takes 1–3 business days. We'll email you when it's done.</p>
          </div>
      </div>
    )
  }

  if (expert?.status === 'rejected') {
    return (
      <div className="p-8 max-w-lg">
          <div className="card p-8 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="font-display text-xl font-bold text-white mb-2">Application not approved</h2>
            <p className="text-ink-400 text-sm">Unfortunately we weren't able to approve your application at this time. Contact support for more information.</p>
          </div>
      </div>
    )
  }

  const completed  = sessions?.filter(s => s.status === 'completed') ?? []
  const totalEarned = completed.reduce((sum, s) => sum + (s.expert_payout ?? 0), 0)
  const active     = sessions?.find(s => s.status === 'active')

  return (
    <div className="p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Hey, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${expert?.available ? 'bg-green-400' : 'bg-ink-600'}`} />
              <span className="text-xs text-ink-400">{expert?.available ? 'Available for sessions' : 'Unavailable'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/expert/profile" className="btn-ghost text-sm">Edit profile</Link>
          </div>
        </div>

        {active && (
          <Link href={`/expert/sessions/${active.id}`}
            className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 hover:bg-green-500/15 transition-colors">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-green-300 text-sm font-medium">Active session — tap to rejoin</p>
            <span className="ml-auto text-green-400">→</span>
          </Link>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total sessions"   value={String(expert?.session_count ?? 0)} />
          <StatCard label="Total earned"     value={`$${totalEarned.toFixed(2)}`} accent />
          <StatCard label="Rating"           value={expert?.rating_avg ? `${expert.rating_avg.toFixed(1)}★` : '—'} sub={`${expert?.rating_count ?? 0} reviews`} />
          <StatCard label="Rate"             value={`$${expert?.hourly_rate ?? 0}/hr`} />
        </div>

        <h2 className="font-display text-base font-bold text-white mb-4">Recent sessions</h2>
        {!sessions?.length ? (
          <div className="card p-8 text-center text-ink-500 text-sm">No sessions yet — your first booking will appear here</div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <Link key={s.id} href={`/expert/sessions/${s.id}`}
                className="card p-4 flex items-center gap-4 hover:border-ink-700 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-100 truncate">{s.problem_title ?? 'Session'}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {(s.customer as any)?.full_name} · {(s.category as any)?.name} · {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.expert_payout && <span className="text-sm font-medium text-green-400">${s.expert_payout.toFixed(2)}</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border
                    ${s.status === 'completed' ? 'bg-ink-800 text-ink-400 border-ink-700' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                    {s.status}
                  </span>
                  <span className="text-ink-600 group-hover:text-ink-400">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}
