import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import AdminProDetailClient from './AdminProDetailClient'

export default async function AdminProDetail({ params }: { params: { id: string } }) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const expert = await prisma.expertProfile.findUnique({
    where:   { id: params.id },
    include: { user: { select: {
      id: true, name: true, email: true, phone: true,
      createdAt: true, emailVerified: true,
      firstName: true, lastName: true,
      city: true, state: true, zip: true,
    }}},
  })

  if (!expert) notFound()

  const [sessions, categories] = await Promise.all([
    prisma.session.findMany({
      where:   { expertId: params.id },
      include: {
        customer: { select: { name: true, email: true } },
        category: { select: { name: true } },
        reviews:  { select: { rating: true, comment: true, reviewerId: true } },
        recording: { select: { id: true, purchaseStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    expert.categoryIds.length
      ? prisma.category.findMany({ where: { id: { in: expert.categoryIds } }, select: { name: true, icon: true } })
      : Promise.resolve([]),
  ])

  const data = {
    expert: {
      id:                      expert.id,
      status:                  expert.status,
      bio:                     expert.bio,
      hourlyRate:              Number(expert.hourlyRate ?? 0),
      available:               expert.available,
      yearsExperience:         expert.yearsExperience,
      certifications:          expert.certifications,
      ratingAvg:               Number(expert.ratingAvg ?? 0),
      ratingCount:             expert.ratingCount,
      sessionCount:            expert.sessionCount,
      stripeConnectId:         expert.stripeConnectId,
      stripeConnectOnboarded:  expert.stripeConnectOnboarded,
      backgroundCheckPassed:   expert.backgroundCheckPassed,
      rejectionReason:         expert.rejectionReason,
      slug:                    (expert as any).slug ?? null,
      specialties:             (expert as any).specialties ?? [],
      emergencyAvailable:      (expert as any).emergencyAvailable ?? false,
      emergencyRate:           Number((expert as any).emergencyRate ?? 0),
      createdAt:               expert.createdAt.toISOString(),
    },
    user: {
      ...expert.user,
      createdAt: expert.user.createdAt.toISOString(),
    },
    sessions: sessions.map(s => ({
      id:                    s.id,
      status:                s.status,
      createdAt:             s.createdAt.toISOString(),
      endedAt:               s.endedAt?.toISOString() ?? null,
      customerName:          s.customer?.name ?? s.customer?.email ?? null,
      categoryName:          s.category?.name ?? null,
      expertPayout:          Number(s.expertPayout ?? 0),
      customerTotal:         Number(s.customerTotal ?? 0),
      durationBilledMinutes: s.durationBilledMinutes ?? null,
      paymentStatus:         s.paymentStatus,
      problemTitle:          s.problemTitle ?? null,
      expertNotes:           s.expertNotes ?? null,
      review:                s.reviews[0] ? { rating: s.reviews[0].rating, comment: s.reviews[0].comment } : null,
      hasRecording:          !!s.recording,
    })),
    categories,
  }

  return <AdminProDetailClient data={data} />
}
