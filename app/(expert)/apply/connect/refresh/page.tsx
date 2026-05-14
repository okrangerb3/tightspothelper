import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createConnectOnboardingLink } from '@/lib/stripe'

// Stripe redirects here if onboarding link expires — we generate a fresh one
export default async function ConnectRefreshPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expert } = await supabase
    .from('expert_profiles').select('stripe_connect_id').eq('id', user.id).single()

  if (!expert?.stripe_connect_id) redirect('/expert/apply/connect')

  const { url } = await createConnectOnboardingLink(expert.stripe_connect_id)
  redirect(url)
}
