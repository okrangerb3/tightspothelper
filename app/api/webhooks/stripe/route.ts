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

    // Storage subscriptions removed — recordings are pay-per-download
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      break

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
