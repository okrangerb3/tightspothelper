import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { createConnectOnboardingLink } from '@/lib/stripe'

export default async function ConnectRefreshPage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  const userId = session.user.id

  const expert = await prisma.expertProfile.findUnique({
    where:  { id: userId },
    select: { stripeConnectId: true },
  })

  if (!expert?.stripeConnectId) redirect('/expert/apply/connect')

  const { url } = await createConnectOnboardingLink(expert.stripeConnectId!)
  redirect(url)
}
