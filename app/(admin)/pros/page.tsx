import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProActions from './ProActions'

export default async function AdminPros({ searchParams }: { searchParams: { filter?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/customer/dashboard')

  const filter = searchParams.filter ?? 'all'

  let query = supabase.from('expert_profiles')
    .select('*, profile:id(full_name,avatar_url,created_at)')
    .order('created_at', { ascending: false })

  if (filter !== 'all') query = query.eq('status', filter)

  const { data: pros } = await query

  const FILTERS = ['all', 'pending', 'approved', 'rejected', 'suspended']
  const STATUS_STYLE: Record<string, string> = {
    pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    approved:  'bg-green-500/10  text-green-400  border-green-500/20',
    rejected:  'bg-red-500/10   text-red-400    border-red-500/20',
    suspended: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  return (
    <div className="p-8 max-w-5xl">
        <h1 className="font-display text-2xl font-bold text-white mb-6">Expert management</h1>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 border-b border-ink-800">
          {FILTERS.map(f => (
            <Link key={f} href={`/admin/pros${f !== 'all' ? `?filter=${f}` : ''}`}
              className={`px-4 py-2.5 text-sm capitalize transition-colors border-b-2 -mb-px
                ${filter === f ? 'border-brand-500 text-white font-medium' : 'border-transparent text-ink-500 hover:text-ink-300'}`}>
              {f}
            </Link>
          ))}
        </div>

        {!pros?.length ? (
          <div className="card p-8 text-center text-ink-500 text-sm">No experts in this filter</div>
        ) : (
          <div className="space-y-2">
            {pros.map((pro: any) => (
              <div key={pro.id} className="card p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-ink-700 flex items-center justify-center text-sm font-medium text-ink-300 shrink-0">
                    {pro.profile?.full_name?.[0] ?? '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{pro.profile?.full_name ?? 'Unknown'}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[pro.status]}`}>
                        {pro.status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5">
                      ${pro.hourly_rate ?? '—'}/hr · {pro.session_count ?? 0} sessions · ★ {pro.rating_avg?.toFixed(1) ?? '—'}
                    </p>
                    {pro.bio && <p className="text-xs text-ink-400 mt-1 line-clamp-1">{pro.bio}</p>}
                    {pro.certifications?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {pro.certifications.map((c: string) => (
                          <span key={c} className="text-[10px] bg-ink-800 text-ink-400 px-2 py-0.5 rounded-full">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <ProActions
                    proId={pro.id}
                    status={pro.status}
                    stripeConnectOnboarded={pro.stripe_connect_onboarded}
                    checkrCandidateId={pro.checkr_candidate_id}
                    backgroundCheckPassed={pro.background_check_passed}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
