import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/Shell'

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  active:    'bg-green-500/10  text-green-400  border-green-500/20',
  completed: 'bg-ink-800       text-ink-400    border-ink-700',
  cancelled: 'bg-red-500/10   text-red-400    border-red-500/20',
  disputed:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export default async function CustomerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single()
  if (profile?.role !== 'customer') redirect(`/${profile?.role}/dashboard`)

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, category:category_id(name,icon), expert:expert_id(full_name)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const totalSessions  = sessions?.length ?? 0
  const totalSpend     = sessions?.filter(s => s.status === 'completed')
                              .reduce((sum, s) => sum + (s.customer_total ?? 0), 0) ?? 0
  const activeSession  = sessions?.find(s => s.status === 'active')

  return (
    <div className="p-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Hey, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
            </h1>
            <p className="text-ink-400 text-sm mt-1">What needs fixing today?</p>
          </div>
          <Link href="/customer/book" className="btn-primary">
            Get help now
          </Link>
        </div>

        {/* Active session alert */}
        {activeSession && (
          <Link
            href={`/customer/sessions/${activeSession.id}`}
            className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 hover:bg-green-500/15 transition-colors"
          >
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-green-300 text-sm font-medium">
              Active session in progress — tap to rejoin
            </p>
            <span className="ml-auto text-green-400 text-sm">→</span>
          </Link>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <StatCard label="Total sessions"  value={String(totalSessions)} />
          <StatCard label="Total spent"     value={`$${totalSpend.toFixed(2)}`} />
          <StatCard label="Status"          value="Active" sub="Account in good standing" accent />
        </div>

        {/* Session history */}
        <div>
          <h2 className="font-display text-base font-bold text-white mb-4">Recent sessions</h2>
          {!sessions?.length ? (
            <div className="card p-8 text-center">
              <p className="text-ink-500 text-sm mb-4">No sessions yet</p>
              <Link href="/customer/book" className="btn-primary">Book your first session</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <Link
                  key={s.id}
                  href={`/customer/sessions/${s.id}`}
                  className="card p-4 flex items-center gap-4 hover:border-ink-700 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-ink-800 flex items-center justify-center text-lg flex-shrink-0">
                    {(s.category as any)?.icon?.replace('ti-', '') ?? '🔧'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-100 truncate">
                      {s.problem_title ?? 'Session'}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {(s.category as any)?.name} · {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.customer_total && (
                      <span className="text-sm font-medium text-ink-300">
                        ${s.customer_total.toFixed(2)}
                      </span>
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
    </div>
  )
}
