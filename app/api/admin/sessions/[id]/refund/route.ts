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

  const { full, amountCents } = await req.json()

  const { data: session } = await admin.from('sessions')
    .select('stripe_payment_intent_id, customer_total, status')
    .eq('id', params.id).single()

  if (!session?.stripe_payment_intent_id)
    return NextResponse.json({ error: 'No payment to refund' }, { status: 400 })

  const refund = await refundSession(
    session.stripe_payment_intent_id,
    full ? undefined : amountCents
  )

  await admin.from('sessions').update({ payment_status: 'refunded' }).eq('id', params.id)

  return NextResponse.json({ ok: true, refundId: refund.id })
}
