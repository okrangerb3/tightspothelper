import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

// POST /api/stripe/portal
// Creates a Stripe Customer Portal session and returns the URL to redirect to.
// Customers use this to manage saved payment methods, view past charges,
// and (in the future) cancel/upgrade storage subscriptions.

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true, email: true, name: true },
  })

  // If the user has never had a card or session, they have no Stripe customer yet.
  // Auto-create one so the portal can open — the portal will just be empty.
  let customerId = user?.stripeCustomerId ?? null
  if (!customerId) {
    const c = await stripe.customers.create({
      email:    user?.email ?? session.user.email,
      name:     user?.name  ?? session.user.name ?? undefined,
      metadata: { user_id: session.user.id },
    })
    customerId = c.id
    await prisma.authUser.update({
      where: { id: session.user.id },
      data:  { stripeCustomerId: customerId },
    })
  }

  // Optional `returnTo` body param so the portal can drop the user back where they came from.
  let returnTo = '/customer/payment-methods'
  try {
    const body = await req.json()
    if (typeof body?.returnTo === 'string' && body.returnTo.startsWith('/')) {
      returnTo = body.returnTo
    }
  } catch { /* no body, use default */ }

  const portal = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${returnTo}`,
  })

  return NextResponse.json({ url: portal.url })
}
