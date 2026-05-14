import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createRecordingPurchase, stripe } from '@/lib/stripe'
import { recordingPrice } from '@/lib/r2'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rec } = await admin.from('recordings')
    .select('id, session_id, plan, deleted_at, duration_seconds')
    .eq('id', params.id).single()

  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rec.deleted_at) return NextResponse.json({ error: 'Recording deleted' }, { status: 410 })
  if (rec.plan !== 'free') return NextResponse.json({ error: 'Already purchased' }, { status: 409 })

  // Verify participant
  const { data: session } = await supabase.from('sessions')
    .select('customer_id, expert_id').eq('id', rec.session_id).single()
  if (!session || (session.customer_id !== user.id && session.expert_id !== user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await supabase
    .from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  if (!profile?.stripe_customer_id)
    return NextResponse.json({ error: 'No payment method on file' }, { status: 402 })

  const durationMins = Math.ceil((rec.duration_seconds ?? 1800) / 60)
  const price        = recordingPrice(durationMins)
  const amountCents  = Math.round(price * 100)

  // Create and immediately confirm the PaymentIntent
  const pi = await createRecordingPurchase({
    customerId:  profile.stripe_customer_id,
    amountCents,
    sessionId:   rec.session_id,
    recordingId: rec.id,
  })

  // Confirm with saved payment method
  const confirmed = await stripe.paymentIntents.confirm(pi.id, {
    payment_method: (await stripe.customers.listPaymentMethods(profile.stripe_customer_id, { type: 'card', limit: 1 })).data[0]?.id,
  })

  if (confirmed.status === 'succeeded') {
    await admin.from('recordings').update({
      plan:       'per_session',
      expires_at: null,
      stripe_payment_intent_id: pi.id,
    }).eq('id', rec.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ clientSecret: confirmed.client_secret, requiresAction: true })
}
