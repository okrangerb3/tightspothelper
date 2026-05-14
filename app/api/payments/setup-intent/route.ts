import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure Stripe customer exists
  let { data: profile } = await admin
    .from('profiles').select('stripe_customer_id, full_name').eq('id', user.id).single()

  let stripeCustomerId = profile?.stripe_customer_id
  if (!stripeCustomerId) {
    const { data: emailRow } = await admin
      .from('user_emails' as any).select('email').eq('id', user.id).single()

    const customer = await stripe.customers.create({
      email:    (emailRow as any)?.email,
      name:     profile?.full_name ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    stripeCustomerId = customer.id
    await admin.from('profiles').update({ stripe_customer_id: stripeCustomerId }).eq('id', user.id)
  }

  // Create SetupIntent — allows saving card without charging
  const setupIntent = await stripe.setupIntents.create({
    customer:             stripeCustomerId,
    payment_method_types: ['card'],
    usage:                'off_session', // card will be charged server-side
    metadata:             { supabase_user_id: user.id },
  })

  return NextResponse.json({ clientSecret: setupIntent.client_secret })
}
