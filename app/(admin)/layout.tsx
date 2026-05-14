import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { PageShell } from '@/components/ui/Shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'admin') redirect('/customer/dashboard')

  return (
    <PageShell role="admin" userName={user.name ?? user.email ?? ''}>
      {children}
    </PageShell>
  )
}
