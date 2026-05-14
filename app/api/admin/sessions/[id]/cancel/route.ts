import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refundSession } from '@/lib/stripe'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { reason } = await req.json()

  const { data: session } = await admin
    .from('sessions')
    .select('stripe_payment_intent_id, payment_status, status')
    .eq('id', params.id)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const cancellableStatuses = ['pending', 'active']
  if (!cancellableStatuses.includes(session.status))
    return NextResponse.json({ error: `Cannot cancel a session with status '${session.status}'` }, { status: 400 })

  // Refund if payment was held
  if (session.stripe_payment_intent_id && session.payment_status === 'held') {
    await refundSession(session.stripe_payment_intent_id)
  }

  await admin.from('sessions').update({
    status: 'cancelled',
    payment_status: session.payment_status === 'held' ? 'refunded' : session.payment_status,
    cancelled_reason: reason ?? 'Cancelled by admin',
    cancelled_at: new Date().toISOString(),
  }).eq('id', params.id)

  return NextResponse.json({ ok: true })
}
