import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createMeetingToken } from '@/lib/daily'
import { captureSessionPayment } from '@/lib/stripe'

// POST /api/sessions/[id]/token — get Daily meeting token
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session } = await supabase.from('sessions')
    .select('daily_room_name,expert_id,customer_id,status')
    .eq('id', params.id).single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isParticipant = session.customer_id === user.id || session.expert_id === user.id
  if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isExpert = session.expert_id === user.id

  // Activate session on first token request
  if (session.status === 'pending') {
    await supabase.from('sessions').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', params.id)
  }

  const { token } = await createMeetingToken(session.daily_room_name, user.id, isExpert)
  return NextResponse.json({ token })
}
