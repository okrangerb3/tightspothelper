import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

// POST /api/sessions/[id]/token — activate session and return Jitsi room info
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const s = await prisma.session.findUnique({
    where:  { id: params.id },
    select: { expertId: true, customerId: true, status: true },
  })

  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isParticipant = s.customerId === session.user.id || s.expertId === session.user.id
  if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (s.status === 'pending') {
    await prisma.session.update({
      where: { id: params.id },
      data:  { status: 'active', startedAt: new Date() },
    })
  }

  // Jitsi uses public room — no token needed. Return room name for client.
  return NextResponse.json({ roomName: `tsh-${params.id}` })
}
