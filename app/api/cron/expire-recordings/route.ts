import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteObject } from '@/lib/r2'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()

  const expired = await prisma.recording.findMany({
    where: {
      purchaseStatus: 'free_window',
      expiresAt:      { lte: now },
    },
    select: { id: true, r2Key: true },
  })

  let deleted = 0
  let failed  = 0

  for (const rec of expired) {
    try {
      if (rec.r2Key) await deleteObject(rec.r2Key)
      await prisma.recording.update({ where: { id: rec.id }, data: { purchaseStatus: 'deleted' } })
      deleted++
    } catch (err) {
      console.error(`Failed to delete recording ${rec.id}:`, err)
      failed++
    }
  }

  console.log(`Recording expiry cron: ${deleted} deleted, ${failed} failed`)
  return NextResponse.json({ deleted, failed, total: expired.length })
}
