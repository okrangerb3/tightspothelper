import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const notifications = await prisma.notification.findMany({
    where:   { userId: session.user.id, readAt: null },
    orderBy: { createdAt: 'desc' },
    take:    20,
  })
  return NextResponse.json({ notifications })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { ids } = await req.json()

  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: session.user.id },
    data:  { readAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
