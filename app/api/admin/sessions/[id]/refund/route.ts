import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { refundSession } from '@/lib/stripe'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  const { full, amountCents } = await req.json()

  const session = await prisma.session.findUnique({
    where:  { id: params.id },
    select: { stripePaymentIntentId: true, customerTotal: true, status: true },
  })

  if (!session?.stripePaymentIntentId)
    return NextResponse.json({ error: 'No payment to refund' }, { status: 400 })

  const refund = await refundSession(
    session.stripePaymentIntentId,
    full ? undefined : amountCents
  )

  await prisma.session.update({
    where: { id: params.id },
    data:  { paymentStatus: 'refunded' },
  })

  return NextResponse.json({ ok: true, refundId: refund.id })
}
