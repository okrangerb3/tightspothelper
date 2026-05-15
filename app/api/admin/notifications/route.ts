import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = new URL(req.url).searchParams.get('userId')
  const prefs  = await (prisma as any).notificationPreferences.findUnique({ where: { userId: userId ?? '' } })
  return NextResponse.json({ prefs })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, adminOverrideEmail, adminOverridePush, adminNote } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  await (prisma as any).notificationPreferences.upsert({
    where:  { userId },
    create: { userId, adminOverrideEmail, adminOverridePush, adminNote },
    update: { adminOverrideEmail, adminOverridePush, adminNote, updatedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
