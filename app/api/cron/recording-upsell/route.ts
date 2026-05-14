import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendRecordingExpiry } from '@/lib/resend'
import { recordingPrice } from '@/lib/r2'

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now    = new Date()
  const in5    = new Date(now.getTime() + 5 * 86400000)

  // Find recordings already upsold so we can skip them
  const alreadySent = await prisma.notification.findMany({
    where:  { type: 'recording_upsell' },
    select: { payload: true },
  })
  const alreadySentIds = alreadySent
    .map(n => (n.payload as any)?.recording_id)
    .filter(Boolean) as string[]

  const recs = await prisma.recording.findMany({
    where: {
      plan:      'free',
      deletedAt: null,
      expiresAt: { gte: now, lte: in5 },
      id:        { notIn: alreadySentIds },
    },
    include: {
      session: {
        select: {
          customerId: true,
          customer:   { select: { email: true, name: true } },
        },
      },
    },
  })

  let sent = 0
  for (const rec of recs) {
    const email = rec.session.customer.email
    if (!email) continue

    const daysLeft        = Math.ceil((rec.expiresAt!.getTime() - now.getTime()) / 86400000)
    const durationMinutes = Math.ceil((rec.durationSeconds ?? 0) / 60)
    const price           = recordingPrice(durationMinutes)

    try {
      await sendRecordingExpiry(email, {
        name:        rec.session.customer.name ?? 'there',
        sessionId:   rec.sessionId,
        recordingId: rec.id,
        daysLeft,
        price,
      })

      await prisma.notification.create({
        data: {
          userId:  rec.session.customerId,
          type:    'recording_upsell',
          payload: { recording_id: rec.id, session_id: rec.sessionId },
        },
      })

      sent++
    } catch (err) {
      console.error('Upsell email failed:', err)
    }
  }

  return NextResponse.json({ sent, total: recs.length })
}
