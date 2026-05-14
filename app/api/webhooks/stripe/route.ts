import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhook } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const payload   = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event
  try {
    event = verifyStripeWebhook(payload, signature)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  switch (event.type) {

    // ── SetupIntent succeeded — card saved ───────────────────
    case 'setup_intent.succeeded': {
      // Card saved for future use — no action needed
      // The payment method is already attached to the customer in Stripe
      console.log('SetupIntent succeeded:', event.data.object.id)
      break
    }

    // ── New storage subscription created ─────────────────────
    case 'customer.subscription.created': {
      const sub  = event.data.object
      const tier = (sub.metadata?.tier ?? 'basic') as string
      const limitMap: Record<string, number> = {
        basic:     10 * 1024 ** 3,
        pro:       50 * 1024 ** 3,
        unlimited: -1,
      }
      const user = await prisma.authUser.findFirst({
        where: { stripeCustomerId: sub.customer as string },
        select: { id: true },
      })
      if (user) {
        await prisma.storageUsage.upsert({
          where:  { stripeSubscriptionId: sub.id },
          update: {},
          create: {
            userId:               user.id,
            tier,
            stripeSubscriptionId: sub.id,
            limitBytes:           limitMap[tier] ?? 10 * 1024 ** 3,
            usedBytes:            0,
            startedAt:            new Date(sub.start_date * 1000),
          },
        })
      }
      break
    }

    // ── Session payment captured ─────────────────────────────
    case 'payment_intent.succeeded': {
      const pi = event.data.object
      if (pi.metadata?.type === 'recording') {
        // Recording purchase confirmed — plan already updated in purchase route
        break
      }
      // Regular session — already handled by /api/sessions/[id]/end
      break
    }

    // ── Session payment failed ───────────────────────────────
    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      if (pi.metadata?.sessionId) {
        await prisma.session.updateMany({
          where: { stripePaymentIntentId: pi.id },
          data:  { paymentStatus: 'failed' },
        })
      }
      break
    }

    // ── Storage subscription updated ─────────────────────────
    case 'customer.subscription.updated': {
      const sub  = event.data.object
      const tier = sub.metadata?.tier ?? 'basic'
      const user = await prisma.authUser.findFirst({
        where: { stripeCustomerId: sub.customer as string },
        select: { id: true },
      })
      if (user) {
        await prisma.storageUsage.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            tier,
            limitBytes: tier === 'unlimited' ? -1 : tier === 'pro' ? 50 * 1024 ** 3 : 10 * 1024 ** 3,
            cancelledAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
          },
        })
      }
      break
    }

    // ── Storage subscription cancelled ───────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await prisma.storageUsage.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data:  { cancelledAt: new Date() },
      })
      break
    }

    // ── Stripe Connect account updated ───────────────────────
    case 'account.updated': {
      const account = event.data.object
      if (account.details_submitted && account.charges_enabled) {
        await prisma.expertProfile.updateMany({
          where: { stripeConnectId: account.id },
          data:  { stripeConnectOnboarded: true },
        })
      }
      break
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
