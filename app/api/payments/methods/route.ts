import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) return NextResponse.json({ methods: [] })

  const methods  = await stripe.customers.listPaymentMethods(user.stripeCustomerId, { type: 'card', limit: 10 })
  const customer = await stripe.customers.retrieve(user.stripeCustomerId)
  const defaultId = typeof customer !== 'string' && !customer.deleted
    ? (customer.invoice_settings?.default_payment_method as string | null)
    : null

  return NextResponse.json({
    methods: methods.data.map(m => ({
      id:       m.id,
      brand:    m.card?.brand   ?? 'card',
      last4:    m.card?.last4   ?? '****',
      expMonth: m.card?.exp_month,
      expYear:  m.card?.exp_year,
      isDefault: m.id === defaultId,
    })),
    defaultId,
  })
}
