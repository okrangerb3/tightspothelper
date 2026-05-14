import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session } = await supabase.from('sessions')
    .select('expert_id').eq('id', params.id).single()
  if (!session || session.expert_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { error } = await admin.from('sessions').update({
    notes:        body.notes,
    parts_needed: body.parts_needed,
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
