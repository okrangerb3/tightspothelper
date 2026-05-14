import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { captureSessionPayment } from '@/lib/stripe'
import { sendSessionSummary } from '@/lib/resend'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { durationSeconds, notes, parts_needed } = await req.json()

  const { data: session } = await admin
    .from('sessions')
    .select('customer_id, expert_id, stripe_payment_intent_id, status, customer_total, category:category_id(name)')
    .eq('id', params.id)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isParticipant = session.customer_id === user.id || session.expert_id === user.id
  if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Idempotent — if already completed, return ok
  if (session.status === 'completed') return NextResponse.json({ ok: true })

  // Capture Stripe payment
  if (session.stripe_payment_intent_id) {
    try {
      await captureSessionPayment(session.stripe_payment_intent_id)
    } catch (err) {
      console.error('Payment capture failed:', err)
    }
  }

  const billedMinutes = Math.ceil((durationSeconds / 60) / 15) * 15

  await admin.from('sessions').update({
    status:                  'completed',
    ended_at:                new Date().toISOString(),
    duration_seconds:        durationSeconds,
    duration_billed_minutes: billedMinutes,
    notes,
    parts_needed,
    payment_status:          'released',
  }).eq('id', params.id)

  // Increment expert session count
  await admin.rpc('increment_expert_sessions', { expert_id: session.expert_id })

  // In-app recording notification will come via Daily.co webhook (async)
  // Send session summary email to customer now
  Promise.all([
    admin.from('user_emails' as any).select('email').eq('id', session.customer_id).single(),
    admin.from('profiles').select('full_name').eq('id', session.customer_id).single(),
    admin.from('recordings').select('id, expires_at').eq('session_id', params.id).maybeSingle(),
  ]).then(([{ data: emailRow }, { data: profile }, { data: recording }]) => {
    const email = (emailRow as any)?.email
    if (!email) return

    return sendSessionSummary(email, {
      name:              (profile as any)?.full_name ?? 'there',
      sessionId:         params.id,
      expertName:        'your expert',
      notes:             notes ?? undefined,
      parts:             Array.isArray(parts_needed) ? parts_needed : undefined,
      totalCharged:      (session.customer_total as number) ?? 0,
      hasRecording:      !!recording,
      recordingExpiresAt: (recording as any)?.expires_at ?? undefined,
    })
  }).catch(e => console.error('Session summary email failed:', e))

  return NextResponse.json({ ok: true })
}
