import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCheckrWebhook, checkrPassed, type CheckrReport } from '@/lib/checkr'
import { sendApplicationResult } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const payload   = await req.text()
  const signature = req.headers.get('x-checkr-signature') ?? ''

  if (!verifyCheckrWebhook(payload, signature))
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const event = JSON.parse(payload)

  if (event.type !== 'report.completed')
    return NextResponse.json({ received: true })

  const report: CheckrReport = event.data.object
  const passed = checkrPassed(report)

  const expertProfile = await prisma.expertProfile.findFirst({
    where:  { checkrReportId: report.id },
    select: { id: true },
  })

  if (!expertProfile) {
    console.error('No expert found for Checkr report:', report.id)
    return NextResponse.json({ received: true })
  }

  await prisma.expertProfile.update({
    where: { id: expertProfile.id },
    data: {
      backgroundCheckPassed: passed,
      status:                passed ? 'approved' : 'pending',
    },
  })

  const expertUser = await prisma.authUser.findUnique({
    where:  { id: expertProfile.id },
    select: { email: true, name: true },
  })

  if (expertUser?.email && expertUser?.name) {
    await sendApplicationResult(expertUser.email, {
      name:     expertUser.name,
      approved: passed,
      reason:   passed ? undefined : 'Background check did not meet our requirements.',
    }).catch(console.error)
  }

  console.log(`Checkr report ${report.id}: ${passed ? 'PASSED' : 'FAILED'} for expert ${expertProfile.id}`)
  return NextResponse.json({ received: true })
}
