import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DisputeControls from './DisputeControls'
import ReviewModerationActions from './ReviewModerationActions'

export default async function AdminSessionDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *, category:category_id(*),
      customer:customer_id(full_name),
      expert:expert_id(full_name)
    `)
    .eq('id', params.id).single()

  if (!session) notFound()

  const { data: photos }    = await supabase.from('session_photos').select('*').eq('session_id', params.id)
  const { data: recording } = await supabase.from('recordings').select('*').eq('session_id', params.id).maybeSingle()
  const { data: dispute }   = await supabase.from('disputes').select('*').eq('session_id', params.id).maybeSingle()
  const { data: reviews }   = await supabase.from('reviews').select('*').eq('session_id', params.id)

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
        <h1 className="font-display text-2xl font-bold text-white">{session.problem_title ?? 'Session'}</h1>
      </div>

      {/* Core details */}
      <div className="card p-5">
        <Row label="Status"       value={session.status} />
        <Row label="Customer"     value={(session.customer as any)?.full_name} />
        <Row label="Expert"       value={(session.expert as any)?.full_name} />
        <Row label="Category"     value={(session.category as any)?.name} />
        <Row label="Created"      value={new Date(session.created_at).toLocaleString()} />
        <Row label="Duration"     value={session.duration_billed_minutes ? `${session.duration_billed_minutes} min` : null} />
        <Row label="Payment"      value={session.payment_status} />
        <Row label="Customer paid" value={session.customer_total ? `$${(session.customer_total as number).toFixed(2)}` : null} />
        <Row label="Platform fee" value={session.platform_fee_amount ? `$${(session.platform_fee_amount as number).toFixed(2)}` : null} />
        <Row label="Expert payout" value={session.expert_payout ? `$${(session.expert_payout as number).toFixed(2)}` : null} />
      </div>

      {/* Problem */}
      {session.problem_description && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Problem description</p>
          <p className="text-sm text-ink-200 leading-relaxed">{session.problem_description}</p>
        </div>
      )}

      {/* Expert notes */}
      {session.notes && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Expert notes</p>
          <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">{session.notes}</p>
          {Array.isArray(session.parts_needed) && (session.parts_needed as string[]).length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {(session.parts_needed as string[]).map((p, i) => (
                <span key={i} className="text-xs bg-ink-800 text-ink-400 px-2 py-0.5 rounded-full">{p}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      {photos && photos.length > 0 && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">{photos.length} photos</p>
          <div className="flex flex-wrap gap-2">
            {photos.map(p => (
              <div key={p.id} className="w-16 h-16 bg-ink-800 rounded-lg flex items-center justify-center">
                <span className="text-xs text-ink-600 capitalize">{p.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recording */}
      {recording && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-2">Recording</p>
          <Row label="Plan"       value={recording.plan} />
          <Row label="Size"       value={recording.size_bytes ? `${((recording.size_bytes as number) / 1024 / 1024).toFixed(0)} MB` : null} />
          <Row label="Expires"    value={recording.expires_at ? new Date(recording.expires_at).toLocaleDateString() : 'Never'} />
          <Row label="Deleted"    value={recording.deleted_at ? new Date(recording.deleted_at).toLocaleDateString() : null} />
        </div>
      )}

      {/* Reviews */}
      {reviews && reviews.length > 0 && (
        <div className="card p-5">
          <p className="text-xs text-ink-500 uppercase tracking-wide mb-3">Reviews ({reviews.length})</p>
          {reviews.map(r => (
            <div key={r.id} className={`py-3 border-b border-ink-800 last:border-0 ${r.flagged ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="text-[10px] text-ink-600">
                  reviewer: {r.reviewer_id?.slice(0, 8)} → reviewee: {r.reviewee_id?.slice(0, 8)}
                </span>
                {r.flagged && (
                  <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">
                    Flagged{r.flagged_reason ? `: ${r.flagged_reason}` : ''}
                  </span>
                )}
              </div>
              {r.comment && <p className="text-xs text-ink-400 mt-1 italic">"{r.comment}"</p>}
              <ReviewModerationActions review={r} />
            </div>
          ))}
        </div>
      )}

      {/* Dispute */}
      <DisputeControls session={session as any} dispute={dispute} />
    </div>
  )
}
