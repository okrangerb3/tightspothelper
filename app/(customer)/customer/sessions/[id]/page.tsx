import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'
import SessionRoom from './SessionRoom'

export default async function SessionPage({ params }: { params: { id: string } }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  const user = session.user

  const dbSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      category: { select: { name: true, icon: true } },
      customer: { select: { name: true } },
      expert:   { select: { name: true } },
    },
  })

  if (!dbSession) notFound()

  const isCustomer = dbSession.customerId === user.id
  const isExpert   = dbSession.expertId   === user.id
  if (!isCustomer && !isExpert) redirect('/customer/dashboard')

  return (
    <SessionRoom
      session={dbSession as any}
      userId={user.id}
      isExpert={isExpert}
    />
  )
}
