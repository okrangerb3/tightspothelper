import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

const DEFAULTS = {
  emailSessionConfirm: true, emailSessionReminder: true,
  emailSessionSummary: true, emailNewBooking: true,
  emailPayoutReleased: true, emailRecordingReady: true,
  emailRecordingExpiry: true, emailMarketing: false,
  pushSessionAlert: true, pushNewBooking: true,
  pushEmergencyRequest: true, pushPayoutReleased: true,
}

export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const prefs = await (prisma as any).notificationPreferences.findUnique({
    where: { userId: session.user.id },
  })
  return NextResponse.json(prefs ?? { ...DEFAULTS, adminOverrideEmail: null, adminOverridePush: null })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { adminOverrideEmail, adminOverridePush, adminNote, userId, id, updatedAt, ...safe } = body

  await (prisma as any).notificationPreferences.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id, ...safe },
    update: { ...safe, updatedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
