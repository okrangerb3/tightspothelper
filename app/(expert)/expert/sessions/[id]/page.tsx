import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import SessionRoom from '@/app/(customer)/customer/sessions/[id]/SessionRoom'

export default async function ExpertSessionPage({ params }: { params: { id: string } }) {
  const authSession = await auth.api.getSession({ headers: headers() })
  if (!authSession) redirect('/login')

  const session = await prisma.session.findUnique({
    where:   { id: params.id },
    include: { category: { select: { name: true, icon: true } } },
  })

  if (!session) notFound()
  if (session.expertId !== authSession.user.id) redirect('/expert/sessions')

  return (
    <SessionRoom
      session={session as any}
      userId={authSession.user.id}
      isExpert={true}
      token={null}
    />
  )
}

