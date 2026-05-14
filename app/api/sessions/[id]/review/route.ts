import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session: authSession, error } = await requireAuth()
  if (error) return error

  const body    = await req.json()
  const rating  = parseInt(String(body.rating))
  const comment = body.comment ?? ''

  if (!rating || rating < 1 || rating > 5)
    return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 })

  const s = await prisma.session.findUnique({
    where:  { id: params.id },
    select: { customerId: true, expertId: true, status: true },
  })

  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isCustomer = s.customerId === authSession.user.id
  const isExpert   = s.expertId   === authSession.user.id

  if (!isCustomer && !isExpert)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (s.status !== 'completed')
    return NextResponse.json({ error: 'Session not completed' }, { status: 400 })

  const revieweeId = isCustomer ? s.expertId : s.customerId

  const existing = await prisma.review.findFirst({
    where: { sessionId: params.id, reviewerId: authSession.user.id },
  })
  if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })

  await prisma.review.create({
    data: {
      sessionId:  params.id,
      reviewerId: authSession.user.id,
      revieweeId,
      rating,
      comment,
    },
  })

  return NextResponse.json({ ok: true })
}
