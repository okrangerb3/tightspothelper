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

  const paymentIntent = await createSessionPaymentIntent({
    customerId:      stripeCustomerId,
    expertConnectId: expert.stripeConnectId!,
    amountCents:     Math.round(pricing.customerTotal * 100),
    payoutCents:     Math.round(pricing.expertPayout  * 100),
    sessionId:       crypto.randomUUID(),
  })

  const newSession = await prisma.session.create({
    data: {
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
      paymentStatus:        'held',
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

const CreateSessionSchema = z.object({
  expertId:           z.string().uuid(),
  categoryId:         z.string().uuid(),
  durationMinutes:    z.number().int().min(15).max(120),
  problemTitle:       z.string().min(5).max(200),
  problemDescription: z.string().min(10),
  scheduledAt:        z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { expertId, categoryId, durationMinutes, problemTitle, problemDescription, scheduledAt } = parsed.data

  // Fetch category + expert in parallel
  const [{ data: category }, { data: expert }] = await Promise.all([
    admin.from('categories').select('*').eq('id', categoryId).single(),
    admin.from('expert_profiles').select('hourly_rate, stripe_connect_id, status').eq('id', expertId).single(),
  ])

  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  if (!expert || expert.status !== 'approved')
    return NextResponse.json({ error: 'Expert unavailable' }, { status: 400 })

  // Ensure Stripe customer exists — create if not
  const { data: customerProfile } = await admin
    .from('profiles').select('stripe_customer_id, full_name').eq('id', user.id).single()

  let stripeCustomerId = customerProfile?.stripe_customer_id
  if (!stripeCustomerId) {
    const { data: emailRow } = await admin
      .from('user_emails' as any).select('email').eq('id', user.id).single()

    const sc = await stripe.customers.create({
      email:    (emailRow as any)?.email,
      name:     customerProfile?.full_name ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    stripeCustomerId = sc.id
    await admin.from('profiles').update({ stripe_customer_id: stripeCustomerId }).eq('id', user.id)
  }

  // Active fee override check
  const { data: override } = await admin
    .from('fee_overrides')
    .select('override_value')
    .eq('category_id', categoryId)
    .lte('starts_at', new Date().toISOString())
    .gte('ends_at',   new Date().toISOString())
    .maybeSingle()

  const feeValue = override?.override_value ?? category.fee_value

  const pricing = calculateSessionPricing({
    expertRatePerHour: expert.hourly_rate!,
    durationMinutes,
    feeType:    category.fee_type,
    feeValue,
    flatTiers:  category.fee_flat_tiers ?? undefined,
  })

  const room          = await createRoom(crypto.randomUUID())
  const paymentIntent = await createSessionPaymentIntent({
    customerId:      stripeCustomerId,
    expertConnectId: expert.stripe_connect_id!,
    amountCents:     Math.round(pricing.customerTotal * 100),
    payoutCents:     Math.round(pricing.expertPayout  * 100),
    sessionId:       room.name,
  })

  const { data: session, error } = await admin.from('sessions').insert({
    customer_id:              user.id,
    expert_id:                expertId,
    category_id:              categoryId,
    status:                   'pending',
    scheduled_at:             scheduledAt ?? new Date().toISOString(),
    expert_rate:              expert.hourly_rate!,
    platform_fee_type:        category.fee_type,
    platform_fee_value:       feeValue,
    session_subtotal:         pricing.subtotal,
    platform_fee_amount:      pricing.platformFee,
    customer_total:           pricing.customerTotal,
    expert_payout:            pricing.expertPayout,
    problem_title:            problemTitle,
    problem_description:      problemDescription,
    daily_room_name:          room.name,
    daily_room_url:           room.url,
    stripe_payment_intent_id: paymentIntent.id,
    payment_status:           'held',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch names + emails for notifications (all in parallel, non-blocking)
  Promise.all([
    admin.from('user_emails' as any).select('email').eq('id', user.id).single(),
    admin.from('user_emails' as any).select('email').eq('id', expertId).single(),
    admin.from('profiles').select('full_name').eq('id', expertId).single(),
  ]).then(([{ data: custEmail }, { data: expEmail }, { data: expProfile }]) => {
    const scheduledAtStr = scheduledAt ?? new Date().toISOString()
    return Promise.all([
      (custEmail as any)?.email ? sendSessionConfirmation((custEmail as any).email, {
        customerName: customerProfile?.full_name ?? 'there',
        expertName:   (expProfile as any)?.full_name ?? 'your expert',
        categoryName: category.name,
        sessionId:    session!.id,
        scheduledAt:  scheduledAtStr,
        totalAmount:  pricing.customerTotal,
      }) : null,
      (expEmail as any)?.email ? sendExpertNewBooking((expEmail as any).email, {
        expertName:   (expProfile as any)?.full_name ?? 'Expert',
        customerName: customerProfile?.full_name ?? 'A customer',
        categoryName: category.name,
        sessionId:    session!.id,
        problemTitle,
        scheduledAt:  scheduledAtStr,
        payout:       pricing.expertPayout,
      }) : null,
    ])
  }).catch(e => console.error('Session notification emails failed:', e))

  return NextResponse.json({ session, pricing, roomUrl: room.url })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, expert:expert_id(full_name), customer:customer_id(full_name), category:category_id(name,icon,slug)')
    .or(`customer_id.eq.${user.id},expert_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  return NextResponse.json({ sessions })
}
