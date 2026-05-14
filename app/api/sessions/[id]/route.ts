import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const s = await prisma.session.findUnique({
    where:   { id: params.id },
    include: {
      expert:   { select: { id: true, name: true, image: true } },
      customer: { select: { id: true, name: true, image: true } },
      category: { select: { id: true, name: true, icon: true } },
      reviews:  true,
      photos:   true,
    },
  })

  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (s.customerId !== session.user.id && s.expertId !== session.user.id && session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ session: s })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const s = await prisma.session.findUnique({ where: { id: params.id }, select: { expertId: true, customerId: true } })
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isParticipant = s.expertId === session.user.id || s.customerId === session.user.id
  if (!isParticipant && session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const updated = await prisma.session.update({
    where: { id: params.id },
    data: {
      expertNotes:    body.notes    ?? undefined,
      customerNotes:  body.notes    ?? undefined,
      notesUpdatedAt: body.notes !== undefined ? new Date() : undefined,
    },
  })
  return NextResponse.json({ ok: true, session: updated })
}
