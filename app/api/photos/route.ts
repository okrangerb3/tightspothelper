import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // Verify user is part of the session
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { customerId: true, expertId: true },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.customerId !== auth.session.user.id && session.expertId !== auth.session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const photos = await prisma.sessionPhoto.findMany({
    where: { sessionId },
    select: { id: true, stage: true, storagePath: true, uploadedBy: true },
  })

  return NextResponse.json({ photos })
}
