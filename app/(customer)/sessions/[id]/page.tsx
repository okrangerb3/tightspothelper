import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SessionRoom from './SessionRoom'

export default async function SessionPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('sessions')
    .select('*, category:category_id(name,icon), customer:customer_id(full_name), expert:expert_id(full_name)')
    .eq('id', params.id)
    .single()

  if (!session) notFound()

  const isCustomer = session.customer_id === user.id
  const isExpert   = session.expert_id   === user.id
  if (!isCustomer && !isExpert) redirect('/customer/dashboard')

  // Get Daily.co meeting token
  const tokenRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sessions/${params.id}/token`, {
    method: 'POST',
    headers: { Cookie: `sb-access-token=${(await supabase.auth.getSession()).data.session?.access_token}` },
  }).catch(() => null)

  const { token } = tokenRes?.ok ? await tokenRes.json() : { token: null }

  return (
    <SessionRoom
      session={session}
      userId={user.id}
      isExpert={isExpert}
      token={token}
    />
  )
}
