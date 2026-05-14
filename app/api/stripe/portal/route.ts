import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId)
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })

  const { returnUrl } = await req.json().catch(() => ({}))

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   user.stripeCustomerId,
    return_url: returnUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/customer/storage`,
  })

  return NextResponse.json({ url: portalSession.url })
}
