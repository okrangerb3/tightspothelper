const CHECKR_API = 'https://api.checkr.com/v1'

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(`${process.env.CHECKR_API_KEY}:`).toString('base64')}`,
})

export interface CheckrCandidate {
  id: string
  email: string
  first_name: string
  last_name: string
}

export interface CheckrReport {
  id: string
  status: 'pending' | 'consider' | 'clear' | 'suspended' | 'dispute'
  result: 'clear' | 'consider' | null
  candidate_id: string
  package: string
}

/** Create a Checkr candidate and initiate background check */
export async function initiateBackgroundCheck(params: {
  email: string
  firstName: string
  lastName: string
  phone?: string
}): Promise<{ candidateId: string; reportId: string }> {
  // 1. Create candidate
  const candidateRes = await fetch(`${CHECKR_API}/candidates`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email:      params.email,
      first_name: params.firstName,
      last_name:  params.lastName,
      phone:      params.phone,
    }),
  })
  if (!candidateRes.ok) throw new Error(`Checkr candidate failed: ${await candidateRes.text()}`)
  const candidate: CheckrCandidate = await candidateRes.json()

  // 2. Create report (tasker package = standard background check)
  const reportRes = await fetch(`${CHECKR_API}/reports`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      package:      'tasker_standard',
      candidate_id: candidate.id,
    }),
  })
  if (!reportRes.ok) throw new Error(`Checkr report failed: ${await reportRes.text()}`)
  const report: CheckrReport = await reportRes.json()

  return { candidateId: candidate.id, reportId: report.id }
}

/** Retrieve the latest report status for a candidate */
export async function getReportStatus(reportId: string): Promise<CheckrReport> {
  const res = await fetch(`${CHECKR_API}/reports/${reportId}`, { headers: headers() })
  if (!res.ok) throw new Error(`Checkr report fetch failed: ${await res.text()}`)
  return res.json()
}

/** Verify Checkr webhook HMAC signature */
export function verifyCheckrWebhook(payload: string, signature: string): boolean {
  const crypto = require('crypto')
  const expected = crypto
    .createHmac('sha256', process.env.CHECKR_WEBHOOK_SECRET ?? '')
    .update(payload)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

/** Map Checkr result → did the check pass */
export function checkrPassed(report: CheckrReport): boolean {
  return report.status === 'clear' || report.result === 'clear'
}
