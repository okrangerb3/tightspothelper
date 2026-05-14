import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'
import ReviewForm from './ReviewForm'

export default async function SessionSummaryPage({ params }: { params: { id: string } }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  const user = session.user

  const dbSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      category: { select: { name: true, icon: true } },
      expert: { select: { name: true } },
      customer: { select: { name: true } },
      photos: { select: { id: true, stage: true, storagePath: true } },
      recordings: { select: { id: true, purchaseStatus: true, expiresAt: true, durationSeconds: true }, take: 1 },
    },
  })

  if (!dbSession) notFound()
  if (dbSession.customerId !== user.id) redirect('/customer/sessions')

  const recording = dbSession.recordings?.[0] ?? null
  const photos    = dbSession.photos

  const review = await prisma.review.findFirst({
    where: { sessionId: params.id, reviewerId: user.id },
    select: { rating: true, comment: true },
  })

  const hasRec   = recording && recording.purchaseStatus !== 'deleted'
  const daysLeft = recording?.expiresAt
    ? Math.ceil((new Date(recording.expiresAt).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/customer/sessions" className="text-xs text-ink-500 hover:text-ink-300 transition-colors mb-6 flex items-center gap-1">
        ← All sessions
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-ink-500">{dbSession.category?.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border
            ${dbSession.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-ink-800 text-ink-400 border-ink-700'}`}>
            {dbSession.status}
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">{dbSession.problemTitle}</h1>
        <p className="text-ink-400 text-sm mt-1">
          With {dbSession.expert?.name} · {new Date(dbSession.createdAt).toLocaleDateString()}
          {dbSession.durationBilledMinutes ? ` · ${dbSession.durationBilledMinutes} min` : ''}
        </p>
      </div>

      {/* Recording CTA */}
      {hasRec && (
        <div className={`card p-4 mb-4 ${daysLeft !== null && daysLeft <= 5 ? 'border-yellow-500/30' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Session recording ready</p>
              <p className="text-xs text-ink-500 mt-0.5">
                {recording.purchaseStatus === 'free_window' && daysLeft !== null
                  ? `Free access — expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                  : 'Saved permanently'}
              </p>
            </div>
            <Link href={`/customer/sessions/${params.id}/recording`} className="btn-primary text-sm py-2">
              Watch
            </Link>
          </div>
        </div>
      )}

      {/* Payment summary */}
      {dbSession.customerTotal && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Payment</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-400">Session subtotal</span><span>${dbSession.sessionSubtotal?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-ink-400">Service fee</span><span>${dbSession.platformFeeAmount?.toFixed(2)}</span></div>
            <div className="flex justify-between font-medium border-t border-ink-800 pt-2 mt-2">
              <span>Total charged</span><span className="text-brand-400">${dbSession.customerTotal?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expert notes */}
      {dbSession.expertNotes && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Expert notes</h2>
          <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">{dbSession.expertNotes}</p>
        </div>
      )}

      {/* Parts needed */}
      {Array.isArray(dbSession.partsNeeded) && (dbSession.partsNeeded as string[]).length > 0 && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Parts needed</h2>
          <div className="flex flex-wrap gap-2">
            {(dbSession.partsNeeded as string[]).map((p: string, i: number) => (
              <span key={i} className="text-xs bg-ink-800 text-ink-300 px-3 py-1 rounded-full">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      {photos && photos.length > 0 && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">
            Photos ({photos.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {photos.map(p => (
              <div key={p.id} className="w-16 h-16 bg-ink-800 rounded-lg flex items-center justify-center">
                <span className="text-xs text-ink-600">📷</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave a review */}
      {dbSession.status === 'completed' && !review && (
        <ReviewForm sessionId={params.id} revieweeId={dbSession.expertId!} />
      )}
      {review && (
        <div className="card p-5">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Your review</h2>
          <div className="flex gap-1 mb-2">
            {[1,2,3,4,5].map(n => (
              <span key={n} className={`text-xl ${n <= review.rating ? 'text-brand-400' : 'text-ink-700'}`}>★</span>
            ))}
          </div>
          {review.comment && <p className="text-sm text-ink-300">{review.comment}</p>}
        </div>
      )}
    </div>
  )
}
