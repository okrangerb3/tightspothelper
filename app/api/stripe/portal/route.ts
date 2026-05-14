import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles').select('stripe_customer_id').eq('id', user.id).single()

  if (!profile?.stripe_customer_id)
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })

  const { returnUrl } = await req.json().catch(() => ({}))

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   profile.stripe_customer_id,
    return_url: returnUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/customer/storage`,
  })

  return NextResponse.json({ url: portalSession.url })
}
