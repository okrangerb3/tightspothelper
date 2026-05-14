import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhook, stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const payload   = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event
  try {
    event = verifyStripeWebhook(payload, signature)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const admin = createAdminClient()

  switch (event.type) {

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
        await admin.from('sessions')
          .update({ payment_status: 'failed' })
          .eq('stripe_payment_intent_id', pi.id)
      }
      break
    }

    // ── Storage subscription updated ─────────────────────────
    case 'customer.subscription.updated': {
      const sub  = event.data.object
      const tier = sub.metadata?.tier ?? 'basic'
      const { data: profile } = await admin
        .from('profiles').select('id').eq('stripe_customer_id', sub.customer).single()
      if (profile) {
        await admin.from('storage_subscriptions').upsert({
          user_id:               profile.id,
          tier,
          stripe_subscription_id: sub.id,
          storage_limit_bytes:   tier === 'unlimited' ? -1 : tier === 'pro' ? 50 * 1024 ** 3 : 10 * 1024 ** 3,
          cancelled_at:          sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        }, { onConflict: 'stripe_subscription_id' })
      }
      break
    }

    // ── Storage subscription cancelled ───────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await admin.from('storage_subscriptions')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    // ── Stripe Connect account updated ───────────────────────
    case 'account.updated': {
      const account = event.data.object
      if (account.details_submitted && account.charges_enabled) {
        await admin.from('expert_profiles')
          .update({ stripe_connect_onboarded: true })
          .eq('stripe_connect_id', account.id)
      }
      break
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
