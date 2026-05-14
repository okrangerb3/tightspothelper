import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// /expert/apply/connect/complete — Stripe redirects here after onboarding
export default async function ConnectCompletePage() {
  const supabase = createClient()
  const admin    = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expert } = await supabase
    .from('expert_profiles').select('stripe_connect_id').eq('id', user.id).single()

  if (expert?.stripe_connect_id) {
    const account = await stripe.accounts.retrieve(expert.stripe_connect_id)
    if (account.details_submitted) {
      await admin.from('expert_profiles')
        .update({ stripe_connect_onboarded: true })
        .eq('id', user.id)
    }
  }

  redirect('/expert/dashboard')
}
