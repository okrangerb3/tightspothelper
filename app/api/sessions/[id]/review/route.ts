import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body     = await req.json()
  const rating   = parseInt(String(body.rating))
  const comment  = body.comment ?? ''

  if (!rating || rating < 1 || rating > 5)
    return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 })

  const { data: session } = await supabase.from('sessions')
    .select('customer_id, expert_id, status').eq('id', params.id).single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isCustomer = session.customer_id === user.id
  const isExpert   = session.expert_id   === user.id

  if (!isCustomer && !isExpert)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (session.status !== 'completed')
    return NextResponse.json({ error: 'Session not completed' }, { status: 400 })

  // Customer reviews the expert; expert reviews the customer
  const revieweeId = isCustomer ? session.expert_id : session.customer_id

  // Prevent duplicate reviews for the same direction
  const { data: existing } = await supabase.from('reviews')
    .select('id')
    .eq('session_id', params.id)
    .eq('reviewer_id', user.id)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })

  const { error } = await admin.from('reviews').insert({
    session_id:  params.id,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating,
    comment,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
