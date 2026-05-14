import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { stripe, createConnectOnboardingLink } from '@/lib/stripe'

export default async function ExpertConnectPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  const userId = session.user.id

  const expert = await prisma.expertProfile.findUnique({
    where:  { id: userId },
    select: { stripeConnectId: true, stripeConnectOnboarded: true },
  })

  if (expert?.stripeConnectOnboarded) redirect('/expert/dashboard')

  let connectId = expert?.stripeConnectId
  if (!connectId) {
    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: { transfers: { requested: true } },
      metadata: { user_id: userId },
    })
    connectId = account.id
    await prisma.expertProfile.update({ where: { id: userId }, data: { stripeConnectId: connectId } })
  }

  const { url } = await createConnectOnboardingLink(connectId)
  redirect(url)
}
