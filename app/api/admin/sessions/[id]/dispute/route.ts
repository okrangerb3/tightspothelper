import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('admin')
  if (error) return error

  const { status, resolution } = await req.json()

  await prisma.dispute.update({
    where: { sessionId: params.id },
    data: {
      status,
      resolution,
      resolvedBy: session.user.id,
      resolvedAt: new Date(),
    },
  })

  if (status === 'resolved') {
    await prisma.session.updateMany({
      where: { id: params.id, status: 'disputed' },
      data:  { status: 'completed' },
    })
  }

  return NextResponse.json({ ok: true })
}

// POST /api/admin/sessions/[id]/dispute — raise a dispute (participants)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { reason } = await req.json()
  if (!reason?.trim()) return NextResponse.json({ error: 'Reason required' }, { status: 400 })

  const s = await prisma.session.findUnique({
    where: { id: params.id },
    select: { customerId: true, expertId: true, status: true },
  })
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isParticipant = s.customerId === session.user.id || s.expertId === session.user.id
  if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.dispute.create({
    data: {
      sessionId: params.id,
      raisedBy:  session.user.id,
      reason:    reason.trim(),
      status:    'open',
    },
  })

  await prisma.session.update({
    where: { id: params.id },
    data:  { status: 'disputed' },
  })

  return NextResponse.json({ ok: true })
}
