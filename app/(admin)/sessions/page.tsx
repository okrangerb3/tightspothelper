import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminSessionsPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient()
  const status   = searchParams.status

  let query = supabase.from('sessions')
    .select(`
      id, status, problem_title, customer_total, platform_fee_amount,
      duration_billed_minutes, created_at, payment_status,
      category:category_id(name),
      customer:customer_id(full_name),
      expert:expert_id(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data: sessions } = await query

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
        {sessions?.map(s => (
          <Link key={s.id} href={`/admin/sessions/${s.id}`}
            className="card p-4 flex items-center gap-4 hover:border-ink-700 transition-colors group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-100 truncate">{s.problem_title ?? 'Session'}</p>
              <p className="text-xs text-ink-500 mt-0.5">
                {(s.customer as any)?.full_name ?? '—'} → {(s.expert as any)?.full_name ?? 'Unassigned'}
                {' · '}{(s.category as any)?.name}
                {s.duration_billed_minutes ? ` · ${s.duration_billed_minutes}m` : ''}
                {' · '}{new Date(s.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {s.platform_fee_amount && <span className="text-xs text-brand-400">${(s.platform_fee_amount as number).toFixed(2)} fee</span>}
              {s.customer_total    && <span className="text-xs text-ink-400">${(s.customer_total as number).toFixed(2)} total</span>}
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.status]}`}>{s.status}</span>
              <span className="text-ink-600 group-hover:text-ink-400">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
