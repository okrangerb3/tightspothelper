import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { PageShell } from '@/components/ui/Shell'

export default async function ExpertLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role && user.role !== 'expert') redirect(`/${user.role}/dashboard`)

  return (
    <PageShell role="expert" userName={user.name ?? user.email ?? ''}>
      {children}
    </PageShell>
  )
}
