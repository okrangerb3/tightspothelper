import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchReport, verifyCheckrSignature, reportStatusToPassed } from '@/lib/checkr'

// Checkr webhook entry point.
// Configure this URL in the Checkr dashboard:
//   https://<your-domain>/api/webhooks/checkr
// and subscribe to at least: report.completed, report.suspended, report.disputed,
// report.upgraded, report.post_adverse_action, report.adjudicated.
//
// `middleware.ts` matcher is scoped to /customer, /expert, /admin — this route
// is therefore NOT auth-gated by middleware. We verify the HMAC signature instead.

// Disable Next.js body parsing — we need the raw body for signature verification.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-checkr-signature')

  if (!verifyCheckrSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type    = event?.type ?? ''
  const payload = event?.data?.object ?? event?.object ?? {}

  // We only care about events that change a report's outcome
  const TERMINAL = new Set([
    'report.completed',
    'report.suspended',
    'report.disputed',
    'report.resumed',
    'report.upgraded',
    'report.adjudicated',
    'report.post_adverse_action',
  ])

  if (!TERMINAL.has(type)) {
    return NextResponse.json({ ok: true, ignored: type })
  }

  const reportId    = payload.id              ?? payload.report_id ?? null
  const candidateId = payload.candidate_id    ?? null
  const status      = payload.status          ?? null
  const result      = payload.result          ?? null

  if (!reportId && !candidateId) {
    return NextResponse.json({ error: 'No report or candidate id in payload' }, { status: 400 })
  }

  // Re-fetch from the source of truth in case the webhook payload is partial.
  let fetched: Awaited<ReturnType<typeof fetchReport>> | null = null
  if (reportId) {
    try {
      fetched = await fetchReport(reportId)
    } catch (err) {
      console.error('Checkr report refetch failed:', err)
    }
  }

  const finalStatus = fetched?.status ?? status
  const finalResult = fetched?.result ?? result
  const finalCandId = fetched?.candidate_id ?? candidateId

  const passed = reportStatusToPassed(String(finalStatus ?? ''), finalResult ?? null)

  // Match by report id first, then by candidate id as a fallback.
  const profile = await prisma.expertProfile.findFirst({
    where: {
      OR: [
        reportId    ? { checkrReportId:    reportId }    : undefined,
        finalCandId ? { checkrCandidateId: finalCandId } : undefined,
      ].filter(Boolean) as any,
    },
    select: { id: true, status: true },
  })

  if (!profile) {
    // Don't 404 — Checkr will retry. Log and ack so a stale check doesn't keep retrying forever.
    console.warn('Checkr webhook for unknown expert', { reportId, candidateId: finalCandId, type })
    return NextResponse.json({ ok: true, matched: false })
  }

  await prisma.expertProfile.update({
    where: { id: profile.id },
    data: {
      checkrReportId:        reportId ?? undefined,
      checkrCandidateId:     finalCandId ?? undefined,
      backgroundCheckPassed: passed,
      // If a previously approved expert came back failed, auto-suspend them.
      // We never auto-approve based on a passed BG check — admin must still review.
      ...(passed === false && profile.status === 'approved' ? { status: 'suspended' as any } : {}),
    },
  })

  return NextResponse.json({ ok: true, matched: true, passed })
}
