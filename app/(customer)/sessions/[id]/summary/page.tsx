import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function SessionSummaryPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *, category:category_id(name,icon),
      expert:expert_id(full_name, rating_avg),
      customer:customer_id(full_name)
    `)
    .eq('id', params.id)
    .single()

  if (!session) notFound()
  if (session.customer_id !== user.id) redirect('/customer/sessions')

  const { data: photos } = await supabase
    .from('session_photos').select('id,stage,file_name').eq('session_id', params.id)

  const { data: recording } = await supabase
    .from('recordings').select('id,plan,expires_at,deleted_at,duration_seconds')
    .eq('session_id', params.id).maybeSingle()

  const { data: review } = await supabase
    .from('reviews').select('rating,comment').eq('session_id', params.id)
    .eq('reviewer_id', user.id).maybeSingle()

  const hasRec   = recording && !recording.deleted_at
  const daysLeft = recording?.expires_at
    ? Math.ceil((new Date(recording.expires_at).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/customer/sessions" className="text-xs text-ink-500 hover:text-ink-300 transition-colors mb-6 flex items-center gap-1">
        ← All sessions
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-ink-500">{(session.category as any)?.name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border
            ${session.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-ink-800 text-ink-400 border-ink-700'}`}>
            {session.status}
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">{session.problem_title}</h1>
        <p className="text-ink-400 text-sm mt-1">
          With {(session.expert as any)?.full_name} · {new Date(session.created_at).toLocaleDateString()}
          {session.duration_billed_minutes ? ` · ${session.duration_billed_minutes} min` : ''}
        </p>
      </div>

      {/* Recording CTA */}
      {hasRec && (
        <div className={`card p-4 mb-4 ${daysLeft !== null && daysLeft <= 5 ? 'border-yellow-500/30' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Session recording ready</p>
              <p className="text-xs text-ink-500 mt-0.5">
                {recording.plan === 'free' && daysLeft !== null
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
      {session.customer_total && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Payment</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-400">Session subtotal</span><span>${(session.session_subtotal as number)?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-ink-400">Service fee</span><span>${(session.platform_fee_amount as number)?.toFixed(2)}</span></div>
            <div className="flex justify-between font-medium border-t border-ink-800 pt-2 mt-2">
              <span>Total charged</span><span className="text-brand-400">${(session.customer_total as number).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expert notes */}
      {session.notes && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Expert notes</h2>
          <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">{session.notes}</p>
        </div>
      )}

      {/* Parts needed */}
      {Array.isArray(session.parts_needed) && (session.parts_needed as string[]).length > 0 && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Parts needed</h2>
          <div className="flex flex-wrap gap-2">
            {(session.parts_needed as string[]).map((p: string, i: number) => (
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
      {session.status === 'completed' && !review && (
        <ReviewForm sessionId={params.id} expertId={session.expert_id} />
      )}
      {review && (
        <div className="card p-5">
          <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Your review</h2>
          <div className="flex gap-1 mb-2">
            {[1,2,3,4,5].map(n => (
              <span key={n} className={n <= review.rating ? 'text-brand-400' : 'text-ink-700'}>★</span>
            ))}
          </div>
          {review.comment && <p className="text-sm text-ink-300">{review.comment}</p>}
        </div>
      )}
    </div>
  )
}

function ReviewForm({ sessionId, expertId }: { sessionId: string; expertId: string }) {
  return (
    <div className="card p-5" id="review">
      <h2 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Leave a review</h2>
      <form action={`/api/sessions/${sessionId}/review`} method="POST" className="space-y-3">
        <input type="hidden" name="expertId" value={expertId} />
        <div className="flex gap-2">
          {[1,2,3,4,5].map(n => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} className="sr-only" />
              <span className="text-2xl text-ink-700 hover:text-brand-400 transition-colors">★</span>
            </label>
          ))}
        </div>
        <textarea name="comment" placeholder="How did it go? (optional)"
          className="input min-h-[80px] resize-none text-sm" />
        <button type="submit" className="btn-primary w-full">Submit review</button>
      </form>
    </div>
  )
}
