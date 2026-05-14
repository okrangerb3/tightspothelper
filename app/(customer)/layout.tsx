import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageShell } from '@/components/ui/Shell'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single()

  if (profile?.role && profile.role !== 'customer') redirect(`/${profile.role}/dashboard`)

  return (
    <PageShell role="customer" userName={profile?.full_name ?? user.email ?? ''}>
      {children}
    </PageShell>
  )
}
