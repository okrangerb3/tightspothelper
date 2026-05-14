import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  if (!profile?.stripe_customer_id)
    return NextResponse.json({ error: 'No billing account' }, { status: 404 })

  // Verify ownership before detaching
  const method = await stripe.paymentMethods.retrieve(params.id)
  if (method.customer !== profile.stripe_customer_id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await stripe.paymentMethods.detach(params.id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  if (!profile?.stripe_customer_id)
    return NextResponse.json({ error: 'No billing account' }, { status: 404 })

  await stripe.customers.update(profile.stripe_customer_id, {
    invoice_settings: { default_payment_method: params.id },
  })
  return NextResponse.json({ ok: true })
}
