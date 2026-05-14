import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import ProActions from './ProActions'

export default async function AdminPros({ searchParams }: { searchParams: { filter?: string } }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const filter = searchParams.filter ?? 'all'

  const pros = await prisma.expertProfile.findMany({
    where:   filter !== 'all' ? { status: filter as any } : undefined,
    include: { user: { select: { name: true, image: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
  })

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

        <div className="flex gap-1 mb-6 border-b border-ink-800">
          {FILTERS.map(f => (
            <Link key={f} href={`/admin/pros${f !== 'all' ? `?filter=${f}` : ''}`}
              className={`px-4 py-2.5 text-sm capitalize transition-colors border-b-2 -mb-px
                ${filter === f ? 'border-brand-500 text-white font-medium' : 'border-transparent text-ink-500 hover:text-ink-300'}`}>
              {f}
            </Link>
          ))}
        </div>

        {!pros.length ? (
          <div className="card p-8 text-center text-ink-500 text-sm">No experts in this filter</div>
        ) : (
          <div className="space-y-2">
            {pros.map(pro => (
              <div key={pro.id} className="card p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-ink-700 flex items-center justify-center text-sm font-medium text-ink-300 shrink-0">
                    {pro.user?.name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{pro.user?.name ?? 'Unknown'}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[pro.status]}`}>
                        {pro.status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5">
                      ${pro.hourlyRate?.toFixed(2) ?? '—'}/hr · {pro.sessionCount ?? 0} sessions · ★ {pro.ratingAvg?.toFixed(1) ?? '—'}
                    </p>
                    {pro.bio && <p className="text-xs text-ink-400 mt-1 line-clamp-1">{pro.bio}</p>}
                    {pro.certifications && (pro.certifications as string[]).length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {(pro.certifications as string[]).map((c: string) => (
                          <span key={c} className="text-[10px] bg-ink-800 text-ink-400 px-2 py-0.5 rounded-full">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ProActions
                    proId={pro.id}
                    status={pro.status}
                    stripeConnectOnboarded={pro.stripeConnectOnboarded}
                    checkrCandidateId={pro.checkrCandidateId}
                    backgroundCheckPassed={pro.backgroundCheckPassed}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
