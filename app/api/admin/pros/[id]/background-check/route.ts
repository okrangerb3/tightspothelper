import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { initiateBackgroundCheck } from '@/lib/checkr'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  if (!process.env.CHECKR_API_KEY)
    return NextResponse.json({ error: 'Checkr not configured' }, { status: 503 })

  const [expertProfile, expertUser] = await Promise.all([
    prisma.expertProfile.findUnique({ where: { id: params.id }, select: { checkrCandidateId: true, status: true } }),
    prisma.authUser.findUnique({ where: { id: params.id }, select: { name: true, email: true } }),
  ])

  if (!expertProfile) return NextResponse.json({ error: 'Expert not found' }, { status: 404 })
  if (!expertUser?.email) return NextResponse.json({ error: 'Expert has no email on record' }, { status: 400 })

  try {
    const nameParts = (expertUser.name ?? 'Unknown').split(' ')
    const { candidateId, reportId } = await initiateBackgroundCheck({
      email:     expertUser.email,
      firstName: nameParts[0] ?? 'Unknown',
      lastName:  nameParts.slice(1).join(' ') || 'Unknown',
    })

    await prisma.expertProfile.update({
      where: { id: params.id },
      data:  { checkrCandidateId: candidateId, checkrReportId: reportId, backgroundCheckPassed: null },
    })

    return NextResponse.json({ ok: true, candidateId, reportId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Checkr initiation failed' }, { status: 500 })
  }
}
