import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

export function calculateSessionPricing(params: {
  expertRatePerHour: number
  durationMinutes:   number
  feeType:           'percentage' | 'flat'
  feeValue:          number
  flatTiers?:        Record<string, number>
}) {
  const { expertRatePerHour, durationMinutes, feeType, feeValue, flatTiers } = params
  const subtotal = parseFloat((expertRatePerHour * (durationMinutes / 60)).toFixed(2))

  let platformFee: number
  if (feeType === 'percentage') {
    platformFee = parseFloat((subtotal * feeValue).toFixed(2))
  } else {
    const tierMinutes = [15, 30, 45, 60, 75, 90, 105, 120]
    const tier        = tierMinutes.find(t => t >= durationMinutes) ?? 120
    platformFee       = flatTiers?.[String(tier)] ?? feeValue
  }

  const customerTotal = parseFloat((subtotal + platformFee).toFixed(2))
  const expertPayout  = subtotal

  return { subtotal, platformFee, customerTotal, expertPayout }
}

/**
 * Pre-auth for 1 hour of the expert's rate (+ fee).
 * We always hold a full hour regardless of selected duration —
 * then settle at actual time used when the session ends.
 */
export async function createSessionPaymentIntent(params: {
  customerId:      string
  expertConnectId: string
  preAuthCents:    number   // 1-hour pre-auth amount
  payoutCents:     number   // estimated payout (1hr)
  sessionId:       string
  paymentMethodId?: string
}) {
  const { customerId, expertConnectId, preAuthCents, payoutCents, sessionId, paymentMethodId } = params

  return stripe.paymentIntents.create({
    amount:         preAuthCents,
    currency:       'usd',
    customer:       customerId,
    capture_method: 'manual',       // hold only — capture at session end with actual amount
    transfer_data: {
      destination: expertConnectId,
      amount:      payoutCents,
    },
    ...(paymentMethodId ? {
      payment_method: paymentMethodId,
      confirm:        true,
      off_session:    true,
    } : {}),
    metadata: { sessionId, preAuth: 'true' },
    description: `TightSpotHelper session ${sessionId} — pre-auth`,
  })
}

/**
 * Capture the actual amount used — called when session ends.
 * Stripe allows capturing less than the authorized amount.
 */
export async function captureSessionPayment(
  paymentIntentId: string,
  actualAmountCents: number,
  actualPayoutCents: number,
  expertConnectId:   string,
) {
  // Update transfer amount to reflect actual payout
  await stripe.paymentIntents.update(paymentIntentId, {
    transfer_data: { destination: expertConnectId, amount: actualPayoutCents },
  })

  return stripe.paymentIntents.capture(paymentIntentId, {
    amount_to_capture: actualAmountCents,
  })
}

export async function refundSession(paymentIntentId: string, amountCents?: number) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountCents ? { amount: amountCents } : {}),
  })
}

export async function createRecordingPurchase(params: {
  customerId:       string
  amountCents:      number
  recordingId:      string
  paymentMethodId?: string
}) {
  const { customerId, amountCents, recordingId, paymentMethodId } = params
  return stripe.paymentIntents.create({
    amount:   amountCents,
    currency: 'usd',
    customer: customerId,
    ...(paymentMethodId ? {
      payment_method: paymentMethodId,
      confirm:        true,
      off_session:    true,
    } : {}),
    metadata:    { recordingId, type: 'recording_purchase' },
    description: `TightSpotHelper recording ${recordingId}`,
  })
}

export function verifyStripeWebhook(payload: string | Buffer, signature: string) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  )
}
