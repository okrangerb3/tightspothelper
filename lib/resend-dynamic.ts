import { Resend } from 'resend'
import { getSetting } from './config'

// Create a Resend client dynamically from DB or env
async function getResendClient(): Promise<Resend> {
  const apiKey = await getSetting('RESEND_API_KEY', process.env.RESEND_API_KEY)
  if (!apiKey) throw new Error('RESEND_API_KEY not configured — set it in Admin Settings or Railway env vars')
  return new Resend(apiKey)
}

export async function getFromEmail(): Promise<string> {
  return (await getSetting('RESEND_FROM_EMAIL')) ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'
}

export async function getAdminEmail(): Promise<string> {
  return (await getSetting('ADMIN_EMAIL')) ?? process.env.ADMIN_EMAIL ?? 'admin@tightspothelper.com'
}

export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  from?: string
}) {
  const resend = await getResendClient()
  const from = params.from ?? await getFromEmail()

  const result = await resend.emails.send({
    from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message} (${result.error.name})`)
  }

  return result
}
