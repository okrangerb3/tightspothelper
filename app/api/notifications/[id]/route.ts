import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth()
  if (error) return error

  await prisma.notification.updateMany({
    where: { id: params.id, userId: session.user.id },
    data:  { readAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
