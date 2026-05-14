import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export default async function ConnectCompletePage() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  const userId = session.user.id

  const expert = await prisma.expertProfile.findUnique({
    where:  { id: userId },
    select: { stripeConnectId: true },
  })

  if (expert?.stripeConnectId) {
    const account = await stripe.accounts.retrieve(expert.stripeConnectId)
    if (account.details_submitted) {
      await prisma.expertProfile.update({ where: { id: userId }, data: { stripeConnectOnboarded: true } })
    }
  }

  redirect('/expert/dashboard')
}
