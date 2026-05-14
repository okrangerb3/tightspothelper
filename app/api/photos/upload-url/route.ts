import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUploadUrl, keys } from '@/lib/r2'
import { z } from 'zod'

const Schema = z.object({
  sessionId:   z.string().uuid(),
  stage:       z.enum(['pre', 'during']),
  fileName:    z.string(),
  contentType: z.string().regex(/^image\//),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { sessionId, stage, fileName, contentType } = parsed.data

  // Verify user is a participant
  const { data: session } = await supabase.from('sessions').select('customer_id,expert_id')
    .eq('id', sessionId).single()
  if (!session || (session.customer_id !== user.id && session.expert_id !== user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ext         = fileName.split('.').pop() ?? 'jpg'
  const safeFile    = `${crypto.randomUUID()}.${ext}`
  const storagePath = keys.photo(sessionId, stage, safeFile)
  const uploadUrl   = await getUploadUrl(storagePath, contentType)

  return NextResponse.json({ uploadUrl, storagePath })
}
