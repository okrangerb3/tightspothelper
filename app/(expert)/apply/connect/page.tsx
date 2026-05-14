import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { stripe, createConnectOnboardingLink } from '@/lib/stripe'

export default async function ExpertConnectPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expert } = await supabase
    .from('expert_profiles')
    .select('stripe_connect_id, stripe_connect_onboarded')
    .eq('id', user.id).single()

  // If already onboarded, go to dashboard
  if (expert?.stripe_connect_onboarded) redirect('/expert/dashboard')

  // Create Stripe Connect account if not yet created
  let connectId = expert?.stripe_connect_id
  if (!connectId) {
    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()

    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: { transfers: { requested: true } },
      metadata: { supabase_user_id: user.id },
    })
    connectId = account.id

    await supabase.from('expert_profiles')
      .update({ stripe_connect_id: connectId })
      .eq('id', user.id)
  }

  // Generate onboarding link and redirect immediately
  const { url } = await createConnectOnboardingLink(connectId)
  redirect(url)
}
