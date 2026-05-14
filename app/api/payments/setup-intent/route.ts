import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const userRecord = await prisma.authUser.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  })

  let stripeCustomerId = userRecord?.stripeCustomerId ?? null

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email:    userRecord?.email ?? undefined,
      name:     userRecord?.name  ?? undefined,
      metadata: { userId: session.user.id },
    })
    stripeCustomerId = customer.id
    await prisma.authUser.update({
      where: { id: session.user.id },
      data:  { stripeCustomerId },
    })
  }

  const setupIntent = await stripe.setupIntents.create({
    customer:             stripeCustomerId,
    payment_method_types: ['card'],
    usage:                'off_session',
    metadata:             { userId: session.user.id },
  })

  return NextResponse.json({ clientSecret: setupIntent.client_secret })
}
