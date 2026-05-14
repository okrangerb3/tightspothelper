import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const ids: string[] | undefined = body?.ids

  const where = ids?.length
    ? { userId: session.user.id, id: { in: ids }, readAt: null }
    : { userId: session.user.id, readAt: null }

  await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
