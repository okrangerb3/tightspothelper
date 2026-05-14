import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  // Storage is now pay-per-recording; count purchased recordings
  const count = await prisma.recording.count({
    where: { purchasedBy: session.user.id, purchaseStatus: 'purchased' },
  })

  return NextResponse.json({ purchasedCount: count })
}
