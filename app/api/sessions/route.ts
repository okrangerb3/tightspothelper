import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { calculateSessionPricing, createSessionPaymentIntent, stripe } from '@/lib/stripe'
import { sendSessionConfirmation, sendExpertNewBooking } from '@/lib/resend'
import { z } from 'zod'

const CreateSessionSchema = z.object({
  expertId:           z.string().uuid(),
  categoryId:         z.string().uuid(),
  durationMinutes:    z.number().int().min(15).max(120),
  problemTitle:       z.string().min(5).max(200),
  problemDescription: z.string().min(10),
  scheduledAt:        z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const { session: auth, error } = await requireAuth()
  if (error) return error

  const body   = await req.json()
  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { expertId, categoryId, durationMinutes, problemTitle, problemDescription, scheduledAt } = parsed.data

  // Fetch category + expert in parallel
  const [category, expert] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId } }),
    prisma.expertProfile.findUnique({ where: { id: expertId } }),
  ])

  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  if (!expert || expert.status !== 'approved')
    return NextResponse.json({ error: 'Expert unavailable' }, { status: 400 })
  if (!expert.stripeConnectId || !expert.stripeConnectOnboarded) {
    return NextResponse.json(
      { error: 'Expert payout account is not configured' },
      { status: 400 },
    )
  }

  // Ensure Stripe customer exists
  const customerUser = await prisma.authUser.findUnique({ where: { id: auth.user.id } })
  let stripeCustomerId = customerUser?.stripeCustomerId

  if (!stripeCustomerId) {
    const sc = await stripe.customers.create({
      email:    auth.user.email,
      name:     auth.user.name ?? undefined,
      metadata: { user_id: auth.user.id },
    })
    stripeCustomerId = sc.id
    await prisma.authUser.update({
      where: { id: auth.user.id },
      data:  { stripeCustomerId: sc.id },
    })
  }

  const [customer, paymentMethods] = await Promise.all([
    stripe.customers.retrieve(stripeCustomerId),
    stripe.customers.listPaymentMethods(stripeCustomerId, { type: 'card', limit: 10 }),
  ])

  const defaultPaymentMethodId =
    typeof customer !== 'string' && !customer.deleted
      ? (customer.invoice_settings?.default_payment_method as string | null)
      : null

  const paymentMethod =
    (defaultPaymentMethodId && paymentMethods.data.find(method => method.id === defaultPaymentMethodId)) ||
    paymentMethods.data[0]

  if (!paymentMethod) {
    return NextResponse.json(
      { error: 'No saved payment method found', redirectTo: '/customer/payment-methods' },
      { status: 402 },
    )
  }

  // Active fee override check
  const now = new Date()
  const override = await prisma.feeOverride.findFirst({
    where: {
      categoryId,
      startsAt: { lte: now },
      endsAt:   { gte: now },
    },
  })

  const feeValue = override ? Number(override.overrideValue) : Number(category.feeValue)

  const pricing = calculateSessionPricing({
    expertRatePerHour: Number(expert.hourlyRate!),
    durationMinutes,
    feeType:   category.feeType as any,
    feeValue,
    flatTiers: category.feeFlatTiers as any ?? undefined,
  })

  const sessionId = crypto.randomUUID()

  const paymentIntent = await createSessionPaymentIntent({
    customerId:      stripeCustomerId,
    expertConnectId: expert.stripeConnectId,
    amountCents:     Math.round(pricing.customerTotal * 100),
    payoutCents:     Math.round(pricing.expertPayout  * 100),
    sessionId,
    paymentMethodId: paymentMethod.id,
  })

  if (paymentIntent.status !== 'requires_capture') {
    return NextResponse.json(
      {
        error: 'Payment requires customer action',
        clientSecret: paymentIntent.client_secret,
        paymentIntentStatus: paymentIntent.status,
      },
      { status: 402 },
    )
  }

  const newSession = await prisma.session.create({
    data: {
      id:                   sessionId,
      customerId:           auth.user.id,
      expertId,
      categoryId,
      status:               'pending',
      scheduledAt:          scheduledAt ? new Date(scheduledAt) : new Date(),
      expertHourlyRate:     expert.hourlyRate!,
      platformFeeType:      category.feeType as any,
      platformFeeValue:     feeValue,
      expertPayout:         pricing.expertPayout,
      platformFee:          pricing.platformFee,
      problemTitle,
      problemDescription,
      stripePaymentIntentId: paymentIntent.id,
      paymentStatus:         'held',
    },
  })

  // Send notifications in background (non-blocking)
  Promise.all([
    sendSessionConfirmation(auth.user.email, {
      customerName: auth.user.name ?? 'there',
      expertName:   auth.user.name ?? 'your expert',
      categoryName: category.name,
      sessionId:    newSession.id,
      scheduledAt:  (scheduledAt ?? new Date().toISOString()),
      totalAmount:  pricing.customerTotal,
    }),
  ]).catch(e => console.error('Session notification emails failed:', e))

  return NextResponse.json({ session: newSession, pricing })
}

export async function GET(_req: NextRequest) {
  const { session: auth, error } = await requireAuth()
  if (error) return error

  const sessions = await prisma.session.findMany({
    where: {
      OR: [
        { customerId: auth.user.id },
        { expertId:   auth.user.id },
      ],
    },
    include: {
      expert:   { select: { name: true } },
      customer: { select: { name: true } },
      category: { select: { name: true, icon: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ sessions })
}
