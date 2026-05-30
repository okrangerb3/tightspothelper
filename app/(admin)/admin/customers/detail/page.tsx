import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import AdminCustomerDetailClient from './AdminCustomerDetailClient'

export default async function AdminCustomerDetail({ searchParams }: { searchParams: { id?: string } }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const user = await prisma.authUser.findUnique({
    where: { id: searchParams.id ?? "" },
    select: {
      id: true, name: true, email: true, phone: true,
      createdAt: true, emailVerified: true, stripeCustomerId: true,
      city: true, state: true, zip: true,
      firstName: true, lastName: true,
    },
  }) as any

  if (!user) notFound()

  const [sessions, notifications] = await Promise.all([
    prisma.session.findMany({
      where:   { customerId: searchParams.id ?? "" },
      include: {
        expert:   { select: { name: true } },
        category: { select: { name: true } },
        reviews:  { select: { rating: true, comment: true } },
        recordings: { select: { id: true, purchaseStatus: true, expiresAt: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.findMany({
      where:   { userId: searchParams.id ?? "" },
      orderBy: { createdAt: 'desc' },
      take:    50,
    }).catch(() => []),
  ])

  // Serialize for client
  const data = {
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      banned:    (user as any).banned ?? false,
    },
    sessions: sessions.map(s => ({
      id:                  s.id,
      status:              s.status,
      createdAt:           s.createdAt.toISOString(),
      endedAt:             s.endedAt?.toISOString() ?? null,
      expertName:          s.expert?.name ?? null,
      categoryName:        s.category?.name ?? null,
      customerTotal:       Number(s.customerTotal ?? 0),
      platformFeeAmount:   Number(s.platformFeeAmount ?? 0),
      durationBilledMinutes: s.durationBilledMinutes ?? null,
      paymentStatus:       s.paymentStatus,
      problemTitle:        s.problemTitle ?? null,
      expertNotes:         s.expertNotes ?? null,
      partsNeeded:         s.partsNeeded as string[],
      stripePaymentIntentId: s.stripePaymentIntentId ?? null,
      review:              s.reviews[0] ? {
        rating:  s.reviews[0].rating,
        comment: s.reviews[0].comment,
      } : null,
      recording: s.recordings?.[0] ? {
        id:             s.recordings[0].id,
        purchaseStatus: s.recordings[0].purchaseStatus,
        expiresAt:      s.recordings[0].expiresAt?.toISOString() ?? null,
      } : null,
    })),
    notifications: notifications.map((n: any) => ({
      id:        n.id,
      type:      n.type,
      payload:   n.payload,
      createdAt: n.createdAt.toISOString(),
      readAt:    n.readAt?.toISOString() ?? null,
    })),
  }

  return <AdminCustomerDetailClient data={data} />
}
