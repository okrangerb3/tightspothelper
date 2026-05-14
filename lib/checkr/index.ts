// Checkr API client — minimal wrapper around the REST endpoints we use.
//
// Auth: HTTP Basic with `${CHECKR_API_KEY}:` (empty password) — Checkr's standard scheme.
// Docs: https://docs.checkr.com/

const BASE = process.env.CHECKR_API_BASE_URL ?? 'https://api.checkr.com/v1'

function authHeader() {
  const key = process.env.CHECKR_API_KEY
  if (!key) throw new Error('CHECKR_API_KEY is not set')
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
}

async function checkr<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': authHeader(),
      'Content-Type':  'application/x-www-form-urlencoded',
      ...(init.headers ?? {}),
    },
    // Important — avoid Next.js caching API calls
    cache: 'no-store',
  })

  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }

  if (!res.ok) {
    const msg = json?.error ?? json?.message ?? text ?? `Checkr ${res.status}`
    throw new Error(`Checkr API ${res.status}: ${msg}`)
  }
  return json as T
}

function form(obj: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v))
  }
  return sp.toString()
}

/** Initiate a background check for an expert applicant.
 *  Creates a Candidate, then invites them to complete their info via a hosted Invitation,
 *  then orders the configured Package. Returns IDs we persist for webhook reconciliation. */
export async function initiateBackgroundCheck(params: {
  email:      string
  firstName:  string
  lastName:   string
  middleName?: string
  phone?:     string
}): Promise<{ candidateId: string; reportId: string | null; invitationId: string | null }> {
  const candidate = await checkr<{ id: string }>('/candidates', {
    method: 'POST',
    body:   form({
      email:       params.email,
      first_name:  params.firstName,
      last_name:   params.lastName,
      middle_name: params.middleName,
      phone:       params.phone,
      // Required by Checkr — applicant fills the rest via the Invitation flow
      no_middle_name: params.middleName ? undefined : true,
    }),
  })

  // Create an Invitation — applicant completes SSN/DOB/etc on Checkr-hosted form.
  // The package slug is configured on the Checkr account (typical: 'tasker_pro_full_criminal').
  const packageSlug = process.env.CHECKR_PACKAGE ?? 'tasker_pro_full_criminal'

  let invitationId: string | null = null
  let reportId:     string | null = null

  try {
    const invitation = await checkr<{ id: string }>('/invitations', {
      method: 'POST',
      body:   form({ candidate_id: candidate.id, package: packageSlug }),
    })
    invitationId = invitation.id
  } catch (err) {
    // If invitations aren't supported on this account, fall back to ordering a Report
    // directly — applicant data must then come from the candidate record alone.
    console.warn('Checkr invitation creation failed, falling back to direct report:', err)
    try {
      const report = await checkr<{ id: string }>('/reports', {
        method: 'POST',
        body:   form({ candidate_id: candidate.id, package: packageSlug }),
      })
      reportId = report.id
    } catch (reportErr) {
      console.error('Checkr report creation also failed:', reportErr)
    }
  }

  return { candidateId: candidate.id, reportId, invitationId }
}

/** Fetch the latest report for a candidate (used by webhook). */
export async function fetchReport(reportId: string) {
  return checkr<{
    id:     string
    status: 'pending' | 'clear' | 'consider' | 'suspended' | 'dispute'
    result: 'clear' | 'consider' | null
    candidate_id: string
    completed_at: string | null
    adjudication: 'engaged' | 'pre_adverse_action' | 'post_adverse_action' | null
  }>(`/reports/${reportId}`, { method: 'GET' })
}

/** Verify a Checkr webhook payload using the configured signing secret.
 *  Checkr signs with HMAC-SHA256 of the raw body, sent as `X-Checkr-Signature`. */
export function verifyCheckrSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CHECKR_WEBHOOK_SECRET
  if (!secret) {
    console.warn('CHECKR_WEBHOOK_SECRET not set — refusing webhook')
    return false
  }
  if (!signatureHeader) return false

  // Sync import to avoid top-level await complications in older Node runtimes.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac, timingSafeEqual } = require('node:crypto')
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')

  // Some Checkr accounts send `sha256=<hex>` instead of plain hex — handle both.
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader

  if (expected.length !== provided.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  } catch {
    return false
  }
}

/** Map a Checkr report status to our boolean `backgroundCheckPassed`.
 *  - `clear`            → passed (true)
 *  - `consider`/`suspended` → failed (false)
 *  - `pending`/`dispute` → unknown (null) — leave the column unchanged. */
export function reportStatusToPassed(status: string, result: string | null): boolean | null {
  if (status === 'clear' || result === 'clear') return true
  if (status === 'consider' || status === 'suspended' || result === 'consider') return false
  return null
}
