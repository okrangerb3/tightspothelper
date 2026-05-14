import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { getDownloadUrl } from '@/lib/r2'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const rec = await prisma.recording.findUnique({
    where:  { id: params.id },
    select: { r2Key: true, r2AdminKey: true, sessionId: true, plan: true, deletedAt: true, expiresAt: true },
  })

  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rec.deletedAt) return NextResponse.json({ error: 'Recording has been deleted' }, { status: 410 })

  const isAdmin = session.user.role === 'admin'

  if (!isAdmin) {
    const s = await prisma.session.findUnique({
      where:  { id: rec.sessionId },
      select: { customerId: true, expertId: true },
    })
    if (!s || (s.customerId !== session.user.id && s.expertId !== session.user.id))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const key = isAdmin ? rec.r2AdminKey : rec.r2Key
  const url = await getDownloadUrl(key!, 3600)
  return NextResponse.json({ url, expiresAt: rec.expiresAt, plan: rec.plan })
}
