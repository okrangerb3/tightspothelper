import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageShell, StatCard } from '@/components/ui/Shell'
import RecordingActions from './RecordingActions'

export default async function AdminRecordings() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/customer/dashboard')

  const { data: recordings } = await supabase
    .from('recordings')
    .select('*, session:session_id(problem_title, customer_id, expert_id, customer:customer_id(full_name))')
    .order('created_at', { ascending: false })
    .limit(50)

  const totalBytes  = recordings?.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0) ?? 0
  const freeBytes   = recordings?.filter(r => r.plan === 'free' && !r.deleted_at).reduce((sum, r) => sum + (r.size_bytes ?? 0), 0) ?? 0
  const paidBytes   = recordings?.filter(r => r.plan !== 'free').reduce((sum, r) => sum + (r.size_bytes ?? 0), 0) ?? 0
  const r2Cost      = totalBytes / 1024 / 1024 / 1024 * 0.015
  const expiringCount = recordings?.filter(r => r.plan === 'free' && !r.deleted_at && r.expires_at &&
    new Date(r.expires_at) < new Date(Date.now() + 7 * 86400000)).length ?? 0

  const fmt = (bytes: number) => bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`

  const PLAN_STYLE: Record<string, string> = {
    free:         'bg-ink-800 text-ink-400',
    per_session:  'bg-blue-500/10 text-blue-400',
    subscription: 'bg-purple-500/10 text-purple-400',
  }

  return (
    <PageShell role="admin" userName={profile?.full_name}>
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
          {recordings?.map(rec => {
            const daysLeft = rec.expires_at
              ? Math.ceil((new Date(rec.expires_at).getTime() - Date.now()) / 86400000)
              : null

            return (
              <div key={rec.id} className={`card p-4 ${rec.deleted_at ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-100 truncate">
                      {(rec.session as any)?.problem_title ?? 'Session'}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {(rec.session as any)?.customer?.full_name ?? '—'}
                      {' · '}{rec.duration_seconds ? `${Math.floor(rec.duration_seconds / 60)}m` : '—'}
                      {' · '}{fmt(rec.size_bytes ?? 0)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {daysLeft !== null && !rec.deleted_at && (
                      <span className={`text-xs ${daysLeft <= 5 ? 'text-red-400' : daysLeft <= 10 ? 'text-yellow-400' : 'text-ink-500'}`}>
                        {rec.deleted_at ? 'Deleted' : daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                      </span>
                    )}
                    {rec.deleted_at && <span className="text-xs text-ink-600">Deleted</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${PLAN_STYLE[rec.plan]}`}>
                      {rec.plan.replace('_', ' ')}
                    </span>
                    {!rec.deleted_at && <RecordingActions recordingId={rec.id} plan={rec.plan} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PageShell>
  )
}
