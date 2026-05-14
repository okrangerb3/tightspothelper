import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import ReviewForm from './ReviewForm'

export default async function ExpertSessionSummaryPage({ params }: { params: { id: string } }) {
  const authSession = await auth.api.getSession({ headers: headers() })
  if (!authSession) redirect('/login')
  const userId = authSession.user.id

  const session = await prisma.session.findUnique({
    where:   { id: params.id },
    include: {
      category: { select: { name: true, icon: true } },
      customer: { select: { name: true } },
      expert:   { select: { name: true } },
    },
  })

  if (!session) notFound()
  if (session.expertId !== userId) redirect('/expert/sessions')

  const [myReview, customerReview] = await Promise.all([
    prisma.review.findFirst({ where: { sessionId: params.id, reviewerId: userId }, select: { rating: true, comment: true } }),
    prisma.review.findFirst({ where: { sessionId: params.id, reviewerId: session.customerId }, select: { rating: true, comment: true } }),
  ])

  const STATUS_STYLE: Record<string, string> = {
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    disputed:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    active:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/expert/sessions" className="text-xs text-ink-500 hover:text-ink-300 transition-colors mb-6 flex items-center gap-1">
        ← All sessions
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-ink-500">{session.category?.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[session.status] ?? ''}`}>
            {session.status}
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">{session.problemTitle}</h1>
        <p className="text-ink-400 text-sm mt-1">
          With {session.customer?.name} · {new Date(session.createdAt).toLocaleDateString()}
          {session.durationBilledMins ? ` · ${session.durationBilledMins} min` : ''}
        </p>
      </div>

      {/* Earnings summary */}
      {session.expertPayout != null && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Earnings</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-400">Session subtotal</span>
              <span>${session.sessionSubtotal?.toFixed(2) ?? '—'}</span>
            </div>
            <div className="flex justify-between font-medium border-t border-ink-800 pt-2 mt-2">
              <span>Your payout</span>
              <span className="text-green-400">${session.expertPayout.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Your notes */}
      {session.expertNotes && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Your notes</h2>
          <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">{session.expertNotes}</p>
          {Array.isArray(session.partsNeeded) && (session.partsNeeded as string[]).length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {(session.partsNeeded as string[]).map((p: string, i: number) => (
                <span key={i} className="text-xs bg-ink-800 text-ink-300 px-3 py-1 rounded-full">{p}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customer's review of you */}
      {customerReview && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">
            Customer's review of you
          </h2>
          <div className="flex gap-1 mb-2">
            {[1,2,3,4,5].map(n => (
              <span key={n} className={`text-xl ${n <= customerReview.rating ? 'text-brand-400' : 'text-ink-700'}`}>★</span>
            ))}
          </div>
          {customerReview.comment && (
            <p className="text-sm text-ink-300 italic">"{customerReview.comment}"</p>
          )}
        </div>
      )}

      {/* Rate the customer */}
      {session.status === 'completed' && !myReview && (
        <ReviewForm
          sessionId={params.id}
          revieweeId={session.customerId}
          label="Rate this customer"
        />
      )}
      {myReview && (
        <div className="card p-5">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Your review of customer</h2>
          <div className="flex gap-1 mb-2">
            {[1,2,3,4,5].map(n => (
              <span key={n} className={`text-xl ${n <= myReview.rating ? 'text-brand-400' : 'text-ink-700'}`}>★</span>
            ))}
          </div>
          {myReview.comment && <p className="text-sm text-ink-300">{myReview.comment}</p>}
        </div>
      )}
    </div>
  )
}
