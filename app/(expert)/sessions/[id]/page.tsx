import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SessionRoom from '@/app/(customer)/sessions/[id]/SessionRoom'

export default async function ExpertSessionPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('sessions')
    .select('*, category:category_id(name,icon)')
    .eq('id', params.id)
    .single()

  if (!session) notFound()
  if (session.expert_id !== user.id) redirect('/expert/sessions')

  // Get Daily meeting token
  const tokenRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/sessions/${params.id}/token`,
    { method: 'POST', cache: 'no-store' }
  ).catch(() => null)

  const { token } = tokenRes?.ok ? await tokenRes.json() : { token: null }

  return (
    <SessionRoom
      session={session}
      userId={user.id}
      isExpert={true}
      token={token}
    />
  )
}
