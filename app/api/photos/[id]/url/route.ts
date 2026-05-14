import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { getDownloadUrl } from '@/lib/r2'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const photo = await prisma.sessionPhoto.findUnique({
    where:  { id: params.id },
    select: { storagePath: true, sessionId: true },
  })
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const s = await prisma.session.findUnique({
    where:  { id: photo.sessionId },
    select: { customerId: true, expertId: true },
  })

  const isParticipant = s && (s.customerId === session.user.id || s.expertId === session.user.id)
  const isAdmin       = session.user.role === 'admin'

  if (!isParticipant && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = await getDownloadUrl(photo.storagePath)
  return NextResponse.json({ url })
}
