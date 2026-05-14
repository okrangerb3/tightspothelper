import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { captureSessionPayment } from '@/lib/stripe'
import { sendSessionSummary } from '@/lib/resend'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session: authSession, error } = await requireAuth()
  if (error) return error

  const { durationSeconds, notes, parts_needed } = await req.json()

  const s = await prisma.session.findUnique({
    where:   { id: params.id },
    include: { category: { select: { name: true } } },
  })

  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isParticipant = s.customerId === authSession.user.id || s.expertId === authSession.user.id
  if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (s.status === 'completed') return NextResponse.json({ ok: true })

  if (s.stripePaymentIntentId) {
    try {
      await captureSessionPayment(s.stripePaymentIntentId)
    } catch (err) {
      console.error('Payment capture failed:', err)
    }
  }

  const billedMinutes = Math.ceil((durationSeconds / 60) / 15) * 15

  await prisma.session.update({
    where: { id: params.id },
    data: {
      status:              'completed',
      endedAt:             new Date(),
      durationSeconds,
      durationBilledMinutes: billedMinutes,
      expertNotes:         notes,
      partsNeeded:         Array.isArray(parts_needed) ? parts_needed : undefined,
      paymentStatus:       'released',
    },
  })

  // Increment expert session count
  if (s.expertId) {
    await prisma.expertProfile.update({
      where: { id: s.expertId },
      data:  { sessionCount: { increment: 1 } },
    }).catch(() => {})
  }

  // Send session summary email async
  prisma.authUser.findUnique({ where: { id: s.customerId }, select: { email: true, name: true } })
    .then(async customer => {
      if (!customer?.email) return
      const expert = await prisma.authUser.findUnique({ where: { id: s.expertId! }, select: { name: true } })
      return sendSessionSummary(customer.email, {
        name:         customer.name ?? 'there',
        sessionId:    params.id,
        expertName:   expert?.name ?? 'your expert',
        notes:        notes ?? undefined,
        parts:        Array.isArray(parts_needed) ? parts_needed : undefined,
        totalCharged: Number(s.customerTotal ?? 0),
        hasRecording: false,
      })
    })
    .catch(e => console.error('Session summary email failed:', e))

  return NextResponse.json({ ok: true })
}
