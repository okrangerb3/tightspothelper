import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { createRecordingPurchase, stripe } from '@/lib/stripe'
import { recordingPrice } from '@/lib/r2'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const rec = await prisma.recording.findUnique({
    where:  { id: params.id },
    select: { id: true, sessionId: true, purchaseStatus: true, durationSeconds: true },
  })

  if (!rec) return NextResponse.json({ error: 'Not found' },         { status: 404 })
  if (rec.purchaseStatus === 'deleted') return NextResponse.json({ error: 'Recording deleted' }, { status: 410 })
  if (rec.purchaseStatus !== 'free_window') return NextResponse.json({ error: 'Already purchased' }, { status: 409 })

  const s = await prisma.session.findUnique({
    where:  { id: rec.sessionId },
    select: { customerId: true, expertId: true },
  })
  if (!s || (s.customerId !== session.user.id && s.expertId !== session.user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId)
    return NextResponse.json({
      error: 'no_payment_method',
      message: 'No payment account found. Please add a payment method first.',
      redirectTo: '/customer/payment-methods',
    }, { status: 402 })

  const methods    = await stripe.customers.listPaymentMethods(user.stripeCustomerId, { limit: 10 })
  const customer   = await stripe.customers.retrieve(user.stripeCustomerId)
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

  const durationMins = Math.ceil((rec.durationSeconds ?? 1800) / 60)
  const price        = recordingPrice(durationMins)
  const amountCents  = Math.round(price * 100)

  const pi = await createRecordingPurchase({
    customerId:  user.stripeCustomerId,
    amountCents,
    recordingId: rec.id,
  })

  const confirmed = await stripe.paymentIntents.confirm(pi.id, {
    payment_method: paymentMethod.id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/customer/sessions/${rec.sessionId}/recording`,
  })

  if (confirmed.status === 'succeeded') {
    await prisma.recording.update({
      where: { id: rec.id },
      data: {
        purchaseStatus:          'purchased',
        expiresAt:               null,
        stripePaymentIntentId:   pi.id,
      },
    })
    return NextResponse.json({ ok: true, purchaseStatus: 'purchased' })
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
