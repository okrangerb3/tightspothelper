import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

// PATCH /api/admin/reviews/[id] — flag or remove a review
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('admin')
  if (error) return error

  const { action, flagged_reason } = await req.json()

  if (action === 'flag') {
    await prisma.review.update({
      where: { id: params.id },
      data: {
        flagged:       true,
        flaggedReason: flagged_reason ?? null,
        moderatedBy:   session.user.id,
        moderatedAt:   new Date(),
      },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'unflag') {
    await prisma.review.update({
      where: { id: params.id },
      data: {
        flagged:       false,
        flaggedReason: null,
        moderatedBy:   session.user.id,
        moderatedAt:   new Date(),
      },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// DELETE /api/admin/reviews/[id] — permanently remove a review
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  await prisma.review.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
