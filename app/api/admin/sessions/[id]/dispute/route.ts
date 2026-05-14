import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, resolution } = await req.json()

  // Update dispute
  const { error: disputeErr } = await admin
    .from('disputes')
    .update({
      status,
      resolution,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('session_id', params.id)

  if (disputeErr) return NextResponse.json({ error: disputeErr.message }, { status: 500 })

  // Update session status if resolved
  if (status === 'resolved') {
    await admin.from('sessions')
      .update({ status: 'completed' })
      .eq('id', params.id)
      .eq('status', 'disputed')
  }

  return NextResponse.json({ ok: true })
}

// POST /api/admin/sessions/[id]/dispute — raise a dispute (participants)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reason } = await req.json()
  if (!reason?.trim()) return NextResponse.json({ error: 'Reason required' }, { status: 400 })

  // Verify participant
  const { data: session } = await supabase
    .from('sessions').select('customer_id, expert_id, status').eq('id', params.id).single()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isParticipant = session.customer_id === user.id || session.expert_id === user.id
  if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin.from('disputes').insert({
    session_id: params.id,
    raised_by:  user.id,
    reason:     reason.trim(),
    status:     'open',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark session as disputed
  await admin.from('sessions').update({ status: 'disputed' }).eq('id', params.id)

  return NextResponse.json({ ok: true })
}
