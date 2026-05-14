import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { sendApplicationResult } from '@/lib/resend'
import { initiateBackgroundCheck } from '@/lib/checkr'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session: adminSession, error } = await requireRole('admin')
  if (error) return error

  const { status, rejection_reason } = await req.json()

  await prisma.expertProfile.update({
    where: { id: params.id },
    data: {
      status,
      rejectionReason: rejection_reason ?? null,
      reviewedBy:      adminSession.user.id,
      reviewedAt:      new Date(),
    },
  })

  await prisma.authUser.update({
    where: { id: params.id },
    data: {
      role: status === 'approved' ? 'expert' : 'customer',
    },
  })

  const [expertProfile, expertUser] = await Promise.all([
    prisma.expertProfile.findUnique({ where: { id: params.id }, select: { checkrCandidateId: true } }),
    prisma.authUser.findUnique({ where: { id: params.id }, select: { name: true, email: true } }),
  ])

  const name  = expertUser?.name  ?? 'Expert'
  const email = expertUser?.email ?? ''

  if (email) {
    sendApplicationResult(email, { name, approved: status === 'approved', reason: rejection_reason })
      .catch(e => console.error('Application email failed:', e))
  }

  if (status === 'approved' && !expertProfile?.checkrCandidateId && email && process.env.CHECKR_API_KEY) {
    const nameParts = name.split(' ')
    initiateBackgroundCheck({
      email,
      firstName: nameParts[0] ?? name,
      lastName:  nameParts.slice(1).join(' ') || 'Unknown',
    }).then(async ({ candidateId, reportId }) => {
      await prisma.expertProfile.update({
        where: { id: params.id },
        data:  { checkrCandidateId: candidateId, checkrReportId: reportId },
      })
    }).catch(e => console.error('Checkr initiation failed:', e))
  }

  return NextResponse.json({ ok: true })
}
