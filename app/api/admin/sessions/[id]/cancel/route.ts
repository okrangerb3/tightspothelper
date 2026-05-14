import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { refundSession } from '@/lib/stripe'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  const { reason } = await req.json()

  const session = await prisma.session.findUnique({
    where:  { id: params.id },
    select: { stripePaymentIntentId: true, paymentStatus: true, status: true },
  })

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  if (!['pending', 'active'].includes(session.status))
    return NextResponse.json({ error: `Cannot cancel a session with status '${session.status}'` }, { status: 400 })

  if (session.stripePaymentIntentId && session.paymentStatus === 'held')
    await refundSession(session.stripePaymentIntentId)

  await prisma.session.update({
    where: { id: params.id },
    data: {
      status:          'cancelled',
      paymentStatus:   session.paymentStatus === 'held' ? 'refunded' : session.paymentStatus,
      cancelledReason: reason ?? 'Cancelled by admin',
      cancelledAt:     new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}
