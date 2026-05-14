import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

/** Calculate the session total and fee for a booking */
export function calculateSessionPricing(params: {
  expertRatePerHour: number
  durationMinutes: number
  feeType: 'percentage' | 'flat'
  feeValue: number
  flatTiers?: Record<string, number>
}) {
  const { expertRatePerHour, durationMinutes, feeType, feeValue, flatTiers } = params
  const subtotal = parseFloat((expertRatePerHour * (durationMinutes / 60)).toFixed(2))

  let platformFee: number
  if (feeType === 'percentage') {
    platformFee = parseFloat((subtotal * feeValue).toFixed(2))
  } else {
    // Find the closest duration tier (round up to next tier)
    const tierMinutes = [15, 30, 45, 60, 75, 90, 105, 120]
    const tier = tierMinutes.find(t => t >= durationMinutes) ?? 120
    platformFee = flatTiers?.[String(tier)] ?? feeValue
  }

  const customerTotal = parseFloat((subtotal + platformFee).toFixed(2))
  const expertPayout  = subtotal

  return { subtotal, platformFee, customerTotal, expertPayout }
}

/** Create a PaymentIntent with amount held until session completes */
export async function createSessionPaymentIntent(params: {
  customerId: string          // Stripe customer ID
  expertConnectId: string     // Stripe Connect account ID
  amountCents: number         // Customer total in cents
  payoutCents: number         // Expert payout in cents
  sessionId: string
  paymentMethodId?: string
}) {
  const { customerId, expertConnectId, amountCents, payoutCents, sessionId, paymentMethodId } = params

  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customerId,
    capture_method: 'manual',        // Hold funds — capture after session
    transfer_data: {
      destination: expertConnectId,
      amount: payoutCents,
    },
    ...(paymentMethodId
      ? {
          payment_method: paymentMethodId,
          confirm: true,
          off_session: true,
        }
      : {}),
    metadata: { sessionId },
    description: `TightSpotHelper session ${sessionId}`,
  })
}

/** Capture held payment after session completes */
export async function captureSessionPayment(paymentIntentId: string) {
  return stripe.paymentIntents.capture(paymentIntentId)
}

/** Refund a completed session (dispute resolution) */
export async function refundSession(paymentIntentId: string, amountCents?: number) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountCents ? { amount: amountCents } : {}),
  })
}

/** Create a storage subscription */
export const STORAGE_PRICES = {
  basic:     process.env.STRIPE_PRICE_STORAGE_BASIC!,
  pro:       process.env.STRIPE_PRICE_STORAGE_PRO!,
  unlimited: process.env.STRIPE_PRICE_STORAGE_UNLIMITED!,
} as const

export async function createStorageSubscription(customerId: string, tier: keyof typeof STORAGE_PRICES) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: STORAGE_PRICES[tier] }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  })
}

/** One-time recording purchase */
export async function createRecordingPurchase(params: {
  customerId: string
  amountCents: number
  sessionId: string
  recordingId: string
}) {
  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: 'usd',
    customer: params.customerId,
    metadata: { sessionId: params.sessionId, recordingId: params.recordingId, type: 'recording' },
    description: `Recording — session ${params.sessionId}`,
  })
}

/** Verify Stripe webhook signature */
export function verifyStripeWebhook(payload: string | Buffer, signature: string) {
  return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!)
}

/** Create Stripe Connect onboarding link */
export async function createConnectOnboardingLink(accountId: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/expert/apply/connect/refresh`,
    return_url:  `${process.env.NEXT_PUBLIC_APP_URL}/expert/apply/connect/complete`,
    type: 'account_onboarding',
  })
}
