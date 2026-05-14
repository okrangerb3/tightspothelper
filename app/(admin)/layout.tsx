import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageShell } from '@/components/ui/Shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/customer/dashboard')

  return (
    <PageShell role="admin" userName={profile?.full_name ?? user.email ?? ''}>
      {children}
    </PageShell>
  )
}
