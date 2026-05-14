import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles').select('stripe_customer_id').eq('id', user.id).single()

  if (!profile?.stripe_customer_id) return NextResponse.json({ methods: [] })

  const methods = await stripe.customers.listPaymentMethods(
    profile.stripe_customer_id, { type: 'card', limit: 10 }
  )

  // Also get default payment method
  const customer = await stripe.customers.retrieve(profile.stripe_customer_id)
  const defaultId = typeof customer !== 'string' && !customer.deleted
    ? (customer.invoice_settings?.default_payment_method as string | null)
    : null

  return NextResponse.json({
    methods: methods.data.map(m => ({
      id:      m.id,
      brand:   m.card?.brand ?? 'card',
      last4:   m.card?.last4 ?? '****',
      expMonth: m.card?.exp_month,
      expYear:  m.card?.exp_year,
      isDefault: m.id === defaultId,
    })),
    defaultId,
  })
}
