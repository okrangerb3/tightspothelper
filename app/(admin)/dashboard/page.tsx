import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageShell, StatCard } from '@/components/ui/Shell'

export default async function AdminDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/customer/dashboard')

  const [
    { count: totalSessions },
    { count: activeSessions },
    { count: pendingPros },
    { count: totalCustomers },
    { data: recentSessions },
    { data: revenueData },
    { data: expiringRecs },
  ] = await Promise.all([
    supabase.from('sessions').select('*', { count: 'exact', head: true }),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('expert_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('sessions').select('*, category:category_id(name), customer:customer_id(full_name), expert:expert_id(full_name)')
      .order('created_at', { ascending: false }).limit(8),
    supabase.from('sessions').select('platform_fee_amount,customer_total').eq('status', 'completed'),
    supabase.from('recordings')
      .select('id,session_id,expires_at,size_bytes')
      .eq('plan', 'free').is('deleted_at', null)
      .lte('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5),
  ])

  const totalRevenue = revenueData?.reduce((sum, s) => sum + (s.platform_fee_amount ?? 0), 0) ?? 0
  const totalGMV     = revenueData?.reduce((sum, s) => sum + (s.customer_total ?? 0), 0) ?? 0

  const STATUS_STYLE: Record<string, string> = {
    pending:   'bg-yellow-500/10 text-yellow-400',
    active:    'bg-green-500/10 text-green-400',
    completed: 'bg-ink-800 text-ink-400',
    cancelled: 'bg-red-500/10 text-red-400',
    disputed:  'bg-orange-500/10 text-orange-400',
  }

  return (
    <PageShell role="admin" userName={profile?.full_name}>
      <div className="p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold text-white">Admin overview</h1>
          <p className="text-xs text-ink-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Alert: pending applications */}
        {(pendingPros ?? 0) > 0 && (
          <Link href="/admin/pros?filter=pending"
            className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 hover:bg-yellow-500/15 transition-colors">
            <span className="text-yellow-400 font-bold text-sm">{pendingPros}</span>
            <p className="text-yellow-300 text-sm">expert application{pendingPros !== 1 ? 's' : ''} waiting for review</p>
            <span className="ml-auto text-yellow-400 text-sm">Review →</span>
          </Link>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Platform revenue" value={`$${totalRevenue.toFixed(2)}`} accent />
          <StatCard label="Total GMV"        value={`$${totalGMV.toFixed(0)}`} />
          <StatCard label="Total sessions"   value={String(totalSessions ?? 0)} sub={`${activeSessions ?? 0} active now`} />
          <StatCard label="Customers"        value={String(totalCustomers ?? 0)} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent sessions */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-bold text-white">Recent sessions</h2>
              <Link href="/admin/sessions" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
            </div>
            <div className="space-y-1.5">
              {recentSessions?.map(s => (
                <Link key={s.id} href={`/admin/sessions/${s.id}`}
                  className="card p-3 flex items-center gap-3 hover:border-ink-700 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink-100 truncate">{s.problem_title ?? 'Session'}</p>
                    <p className="text-[10px] text-ink-500">
                      {(s.customer as any)?.full_name} → {(s.expert as any)?.full_name} · {(s.category as any)?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.platform_fee_amount && (
                      <span className="text-xs text-brand-400">${s.platform_fee_amount.toFixed(2)}</span>
                    )}
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick links + expiring recordings */}
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-sm font-bold text-white mb-3">Management</h2>
              <div className="space-y-1.5">
                {[
                  { href: '/admin/pros?filter=pending', label: `Pending applications (${pendingPros ?? 0})`, urgent: (pendingPros ?? 0) > 0 },
                  { href: '/admin/categories',          label: 'Category fee config' },
                  { href: '/admin/sessions',            label: 'All sessions' },
                  { href: '/admin/recordings',          label: 'Recording storage' },
                ].map(item => (
                  <Link key={item.href} href={item.href}
                    className={`block card p-3 text-sm transition-colors hover:border-ink-700
                      ${item.urgent ? 'text-yellow-300 border-yellow-500/20' : 'text-ink-300'}`}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {expiringRecs && expiringRecs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-sm font-bold text-white">Recordings expiring soon</h2>
                  <Link href="/admin/recordings" className="text-xs text-brand-400">View all →</Link>
                </div>
                <div className="space-y-1.5">
                  {expiringRecs.map(r => (
                    <div key={r.id} className="card p-3">
                      <p className="text-[10px] text-ink-400 font-mono truncate">{r.session_id}</p>
                      <p className="text-[10px] text-red-400 mt-0.5">
                        Expires {new Date(r.expires_at).toLocaleDateString()}
                        {' · '}{((r.size_bytes ?? 0) / 1024 / 1024).toFixed(0)} MB
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
