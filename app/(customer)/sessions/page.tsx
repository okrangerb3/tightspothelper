import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  active:    'bg-green-500/10  text-green-400  border-green-500/20',
  completed: 'bg-ink-800       text-ink-400    border-ink-700',
  cancelled: 'bg-red-500/10   text-red-400    border-red-500/20',
  disputed:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export default async function CustomerSessionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, status, problem_title, problem_description,
      customer_total, expert_payout, duration_billed_minutes,
      created_at, started_at, ended_at,
      category:category_id(name, icon),
      expert:expert_id(full_name)
    `)
    .eq('customer_id', user!.id)
    .order('created_at', { ascending: false })

  const { data: recordings } = await supabase
    .from('recordings')
    .select('session_id, plan, expires_at, deleted_at')
    .in('session_id', sessions?.map(s => s.id) ?? [])

  const recMap = Object.fromEntries((recordings ?? []).map(r => [r.session_id, r]))

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">My sessions</h1>
        <Link href="/customer/book" className="btn-primary">New session</Link>
      </div>

      {!sessions?.length ? (
        <div className="card p-12 text-center">
          <p className="text-ink-500 mb-4">No sessions yet</p>
          <Link href="/customer/book" className="btn-primary">Book your first session</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const rec       = recMap[s.id]
            const hasRec    = rec && !rec.deleted_at
            const recExpiry = rec?.expires_at ? new Date(rec.expires_at) : null
            const daysLeft  = recExpiry ? Math.ceil((recExpiry.getTime() - Date.now()) / 86400000) : null

            return (
              <Link key={s.id} href={
                s.status === 'active' ? `/customer/sessions/${s.id}` : `/customer/sessions/${s.id}/summary`
              } className="card p-5 flex gap-4 hover:border-ink-700 transition-colors group block">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-medium text-ink-100">{s.problem_title ?? 'Session'}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">
                    {(s.category as any)?.name}
                    {(s.expert as any)?.full_name ? ` · ${(s.expert as any).full_name}` : ''}
                    {s.duration_billed_minutes ? ` · ${s.duration_billed_minutes} min` : ''}
                    {' · '}{new Date(s.created_at).toLocaleDateString()}
                  </p>
                  {hasRec && daysLeft !== null && daysLeft <= 7 && rec.plan === 'free' && (
                    <p className="text-xs text-yellow-400 mt-1">
                      Recording expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} —{' '}
                      <span className="underline">keep it</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {s.customer_total && (
                    <span className="text-sm font-medium text-ink-300">${(s.customer_total as number).toFixed(2)}</span>
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
