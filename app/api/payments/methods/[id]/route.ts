import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true },
  })
  if (!user?.stripeCustomerId)
    return NextResponse.json({ error: 'No billing account' }, { status: 404 })

  const method = await stripe.paymentMethods.retrieve(params.id)
  if (method.customer !== user.stripeCustomerId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await stripe.paymentMethods.detach(params.id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: { stripeCustomerId: true },
  })
  if (!user?.stripeCustomerId)
    return NextResponse.json({ error: 'No billing account' }, { status: 404 })

  await stripe.customers.update(user.stripeCustomerId, {
    invoice_settings: { default_payment_method: params.id },
  })
  return NextResponse.json({ ok: true })
}
