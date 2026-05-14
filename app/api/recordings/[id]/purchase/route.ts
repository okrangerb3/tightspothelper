import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createRecordingPurchase, stripe } from '@/lib/stripe'
import { recordingPrice } from '@/lib/r2'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rec } = await admin
    .from('recordings')
    .select('id, session_id, plan, deleted_at, duration_seconds')
    .eq('id', params.id)
    .single()

  if (!rec)          return NextResponse.json({ error: 'Not found' },         { status: 404 })
  if (rec.deleted_at) return NextResponse.json({ error: 'Recording deleted' }, { status: 410 })
  if (rec.plan !== 'free') return NextResponse.json({ error: 'Already purchased' }, { status: 409 })

  // Verify participant
  const { data: session } = await supabase
    .from('sessions').select('customer_id, expert_id').eq('id', rec.session_id).single()
  if (!session || (session.customer_id !== user.id && session.expert_id !== user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile } = await admin
    .from('profiles').select('stripe_customer_id').eq('id', user.id).single()

  if (!profile?.stripe_customer_id)
    return NextResponse.json({
      error: 'no_payment_method',
      message: 'No payment account found. Please add a payment method first.',
      redirectTo: '/customer/payment-methods',
    }, { status: 402 })

  // Get default payment method
  const methods = await stripe.customers.listPaymentMethods(profile.stripe_customer_id, { limit: 10 })
  const customer = await stripe.customers.retrieve(profile.stripe_customer_id)
  const defaultPmId = typeof customer !== 'string' && !customer.deleted
    ? (customer.invoice_settings?.default_payment_method as string | null)
    : null

  const paymentMethod = defaultPmId
    ? methods.data.find(m => m.id === defaultPmId) ?? methods.data[0]
    : methods.data[0]

  if (!paymentMethod)
    return NextResponse.json({
      error: 'no_payment_method',
      message: 'No saved card found. Please add a payment method first.',
      redirectTo: '/customer/payment-methods',
    }, { status: 402 })

  const durationMins = Math.ceil((rec.duration_seconds ?? 1800) / 60)
  const price        = recordingPrice(durationMins)
  const amountCents  = Math.round(price * 100)

  // Create PaymentIntent and confirm with saved card
  const pi = await createRecordingPurchase({
    customerId:  profile.stripe_customer_id,
    amountCents,
    sessionId:   rec.session_id,
    recordingId: rec.id,
  })

  const confirmed = await stripe.paymentIntents.confirm(pi.id, {
    payment_method: paymentMethod.id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/customer/sessions/${rec.session_id}/recording`,
  })

  if (confirmed.status === 'succeeded') {
    await admin.from('recordings').update({
      plan:                    'per_session',
      expires_at:              null,
      stripe_payment_intent_id: pi.id,
    }).eq('id', rec.id)

    return NextResponse.json({ ok: true, plan: 'per_session' })
  }

  if (confirmed.status === 'requires_action') {
    return NextResponse.json({
      ok:             false,
      requiresAction: true,
      clientSecret:   confirmed.client_secret,
    })
  }

  return NextResponse.json({ error: 'Payment failed — please try again' }, { status: 402 })
}
