import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/Shell'

export default async function ExpertEarningsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, expert_payout, customer_total, duration_billed_minutes, created_at, category:category_id(name)')
    .eq('expert_id', user!.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const { data: expert } = await supabase
    .from('expert_profiles')
    .select('stripe_connect_id, stripe_connect_onboarded, hourly_rate')
    .eq('id', user!.id)
    .single()

  const totalEarned    = sessions?.reduce((s, r) => s + (r.expert_payout ?? 0), 0) ?? 0
  const thisMonth      = sessions?.filter(s => {
    const d = new Date(s.created_at)
    const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).reduce((s, r) => s + (r.expert_payout ?? 0), 0) ?? 0
  const avgPerSession  = sessions?.length ? totalEarned / sessions.length : 0

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white mb-6">Earnings</h1>

      {!expert?.stripe_connect_onboarded && (
        <div className="card p-5 mb-6 border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm font-medium text-yellow-300 mb-1">Payout account not connected</p>
          <p className="text-xs text-ink-400 mb-3">Connect your bank account via Stripe to receive payouts</p>
          <a href="/expert/apply/connect" className="btn-primary text-sm py-2">Connect payout account</a>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <StatCard label="Total earned"     value={`$${totalEarned.toFixed(2)}`} accent />
        <StatCard label="This month"       value={`$${thisMonth.toFixed(2)}`} />
        <StatCard label="Avg per session"  value={`$${avgPerSession.toFixed(2)}`} />
      </div>

      <h2 className="font-display text-sm font-bold text-white mb-3">Completed sessions</h2>
      {!sessions?.length ? (
        <div className="card p-8 text-center text-ink-500 text-sm">No completed sessions yet</div>
      ) : (
        <div className="card divide-y divide-ink-800">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-ink-200">{(s.category as any)?.name ?? 'Session'}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {new Date(s.created_at).toLocaleDateString()}
                  {s.duration_billed_minutes ? ` · ${s.duration_billed_minutes} min` : ''}
                </p>
              </div>
              <span className="text-sm font-medium text-green-400">
                ${(s.expert_payout as number ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
