import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { getUploadUrl, keys } from '@/lib/r2'
import { z } from 'zod'

const Schema = z.object({
  sessionId:   z.string().uuid(),
  stage:       z.enum(['pre', 'during']),
  fileName:    z.string(),
  contentType: z.string().regex(/^image\//),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { sessionId, stage, fileName, contentType } = parsed.data

  const s = await prisma.session.findUnique({
    where:  { id: sessionId },
    select: { customerId: true, expertId: true },
  })
  if (!s || (s.customerId !== session.user.id && s.expertId !== session.user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ext         = fileName.split('.').pop() ?? 'jpg'
  const safeFile    = `${crypto.randomUUID()}.${ext}`
  const storagePath = keys.photo(sessionId, stage, safeFile)

  // Create the DB record now; upload happens client-side directly to R2
  const photo = await prisma.sessionPhoto.create({
    data: {
      sessionId,
      uploadedBy:  session.user.id,
      storagePath,
      stage:       stage as 'pre' | 'during',
    },
  })

  const uploadUrl = await getUploadUrl(storagePath, contentType)

  // Emit photo:added to the session socket room so other clients update in real-time
  const io = (globalThis as Record<string, unknown>).__io as any
  io?.to(`session:${sessionId}`).emit('photo:added', {
    id: photo.id,
    sessionId,
    uploadedBy: session.user.id,
    storagePath,
    stage,
    createdAt: photo.createdAt.toISOString(),
  })

  return NextResponse.json({ uploadUrl, photoId: photo.id, storagePath })
}

