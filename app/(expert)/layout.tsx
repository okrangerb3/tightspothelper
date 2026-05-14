import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageShell } from '@/components/ui/Shell'

export default async function ExpertLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single()

  if (profile?.role && profile.role !== 'expert') redirect(`/${profile.role}/dashboard`)

  return (
    <PageShell role="expert" userName={profile?.full_name ?? user.email ?? ''}>
      {children}
    </PageShell>
  )
}
