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
  const uploadUrl   = await getUploadUrl(storagePath, contentType)

  return NextResponse.json({ uploadUrl, storagePath })
}
