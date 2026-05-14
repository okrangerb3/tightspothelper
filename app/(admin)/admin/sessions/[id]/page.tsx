import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import DisputeControls from './DisputeControls'
import ReviewModerationActions from './ReviewModerationActions'

export default async function AdminSessionDetailPage({ params }: { params: { id: string } }) {
  const session = await prisma.session.findUnique({
    where:   { id: params.id },
    include: {
      category: true,
      customer: { select: { name: true } },
      expert:   { select: { name: true } },
      photos:   true,
      reviews:  true,
      disputes: true,
    },
  })

  if (!session) notFound()

  const recording = await prisma.recording.findFirst({ where: { sessionId: params.id } })
  const dispute   = session.disputes[0] ?? null

  const Row = ({ label, value }: { label: string; value?: string | null }) => value ? (
    <div className="flex justify-between py-2 border-b border-ink-800 last:border-0 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-200 text-right max-w-xs">{value}</span>
    </div>
  ) : null

  return (
    <div className="p-8 max-w-3xl space-y-5">
      <div>
        <p className="text-xs text-ink-500 font-mono mb-1">{session.id}</p>
        <h1 className="font-display text-2xl font-bold text-white">{session.problemTitle ?? 'Session'}</h1>
      </div>

      <div className="card p-5">
        <Row label="Status"        value={session.status} />
        <Row label="Customer"      value={session.customer?.name} />
        <Row label="Expert"        value={session.expert?.name} />
        <Row label="Category"      value={session.category?.name} />
        <Row label="Created"       value={new Date(session.createdAt).toLocaleString()} />
        <Row label="Duration"      value={session.durationBilledMinutes ? `${session.durationBilledMinutes} min` : null} />
        <Row label="Payment"       value={session.paymentStatus} />
        <Row label="Expert payout" value={session.expertPayout ? `$${session.expertPayout.toFixed(2)}` : null} />
        <Row label="Platform fee"  value={session.platformFee ? `$${session.platformFee.toFixed(2)}` : null} />
      </div>

      {session.problemDescription && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Problem description</p>
          <p className="text-sm text-ink-200 leading-relaxed">{session.problemDescription}</p>
        </div>
      )}

      {session.expertNotes && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Expert notes</p>
          <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">{session.expertNotes}</p>
        </div>
      )}

      {session.photos.length > 0 && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">{session.photos.length} photos</p>
          <div className="flex flex-wrap gap-2">
            {session.photos.map(p => (
              <div key={p.id} className="w-16 h-16 bg-ink-800 rounded-lg flex items-center justify-center">
                <span className="text-xs text-ink-600 capitalize">{p.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recording && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Recording</p>
          <Row label="Status"  value={recording.purchaseStatus} />
          <Row label="Size"    value={recording.fileSizeBytes ? `${(Number(recording.fileSizeBytes) / 1024 / 1024).toFixed(0)} MB` : null} />
          <Row label="Expires" value={recording.expiresAt ? new Date(recording.expiresAt).toLocaleDateString() : 'Never'} />
        </div>
      )}

      {session.reviews.length > 0 && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-3">Reviews ({session.reviews.length})</p>
          {session.reviews.map(r => (
            <div key={r.id} className={`py-3 border-b border-ink-800 last:border-0 ${r.flagged ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="text-[10px] text-ink-600">
                  reviewer: {r.reviewerId?.slice(0, 8)} → reviewee: {r.revieweeId?.slice(0, 8)}
                </span>
                {r.flagged && (
                  <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">
                    Flagged{r.flaggedReason ? `: ${r.flaggedReason}` : ''}
                  </span>
                )}
              </div>
              {r.comment && <p className="text-xs text-ink-400 mt-1 italic">"{r.comment}"</p>}
              <ReviewModerationActions review={r} />
            </div>
          ))}
        </div>
      )}

      <DisputeControls session={session as any} dispute={dispute} />
    </div>
  )
}


  if (!session) notFound()

  const recording = await prisma.recording.findFirst({ where: { sessionId: params.id } })

  const Row = ({ label, value }: { label: string; value?: string | null }) => value ? (
    <div className="flex justify-between py-2 border-b border-ink-800 last:border-0 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-200 text-right max-w-xs">{value}</span>
    </div>
  ) : null

  return (
    <div className="p-8 max-w-3xl space-y-5">
      <div>
        <p className="text-xs text-ink-500 font-mono mb-1">{session.id}</p>
        <h1 className="font-display text-2xl font-bold text-white">{session.problemTitle ?? 'Session'}</h1>
      </div>

      <div className="card p-5">
        <Row label="Status"        value={session.status} />
        <Row label="Customer"      value={session.customer?.name} />
        <Row label="Expert"        value={session.expert?.name} />
        <Row label="Category"      value={session.category?.name} />
        <Row label="Created"       value={new Date(session.createdAt).toLocaleString()} />
        <Row label="Duration"      value={session.durationBilledMins ? `${session.durationBilledMins} min` : null} />
        <Row label="Payment"       value={session.paymentStatus} />
        <Row label="Customer paid" value={session.customerTotal ? `$${session.customerTotal.toFixed(2)}` : null} />
        <Row label="Platform fee"  value={session.platformFeeAmount ? `$${session.platformFeeAmount.toFixed(2)}` : null} />
        <Row label="Expert payout" value={session.expertPayout ? `$${session.expertPayout.toFixed(2)}` : null} />
      </div>

      {session.problemDescription && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Problem description</p>
          <p className="text-sm text-ink-200 leading-relaxed">{session.problemDescription}</p>
        </div>
      )}

      {session.expertNotes && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Expert notes</p>
          <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">{session.expertNotes}</p>
          {Array.isArray(session.partsNeeded) && (session.partsNeeded as string[]).length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {(session.partsNeeded as string[]).map((p, i) => (
                <span key={i} className="text-xs bg-ink-800 text-ink-400 px-2 py-0.5 rounded-full">{p}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {session.photos.length > 0 && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">{session.photos.length} photos</p>
          <div className="flex flex-wrap gap-2">
            {session.photos.map(p => (
              <div key={p.id} className="w-16 h-16 bg-ink-800 rounded-lg flex items-center justify-center">
                <span className="text-xs text-ink-600 capitalize">{p.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recording && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Recording</p>
          <Row label="Status"  value={recording.purchaseStatus} />
          <Row label="Size"    value={recording.fileSizeBytes ? `${(Number(recording.fileSizeBytes) / 1024 / 1024).toFixed(0)} MB` : null} />
          <Row label="Expires" value={recording.expiresAt ? new Date(recording.expiresAt).toLocaleDateString() : 'Never'} />
        </div>
      )}

      {session.reviews.length > 0 && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-3">Reviews ({session.reviews.length})</p>
          {session.reviews.map(r => (
            <div key={r.id} className={`py-3 border-b border-ink-800 last:border-0 ${r.flagged ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="text-[10px] text-ink-600">
                  reviewer: {r.reviewerId?.slice(0, 8)} → reviewee: {r.revieweeId?.slice(0, 8)}
                </span>
                {r.flagged && (
                  <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">
                    Flagged{r.flaggedReason ? `: ${r.flaggedReason}` : ''}
                  </span>
                )}
              </div>
              {r.comment && <p className="text-xs text-ink-400 mt-1 italic">"{r.comment}"</p>}
              <ReviewModerationActions review={r} />
            </div>
          ))}
        </div>
      )}

      <DisputeControls session={session as any} dispute={dispute} />
    </div>
  )
}

