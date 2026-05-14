import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  const sub = await prisma.storageUsage.findFirst({
    where:   { userId: session.user.id, cancelledAt: null },
    orderBy: { startedAt: 'desc' },
  })

  return NextResponse.json({
    tier:       sub?.tier       ?? 'free',
    usedBytes:  sub?.usedBytes  ?? 0,
    limitBytes: sub?.limitBytes ?? 0,
  })
}
