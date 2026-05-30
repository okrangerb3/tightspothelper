const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM   = process.env.TWILIO_PHONE_NUMBER!
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

export async function sendSMS(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? 'Twilio send failed')
  return data
}

export function buildInviteSMS(params: {
  businessName: string
  categoryName: string
  customerCity: string
  inviteCode:   string
}) {
  return `Hi ${params.businessName}! A customer in ${params.customerCity} needs help with ${params.categoryName} via TightSpotHelper. Join our network of remote repair experts and earn $50-200+/session. Sign up: ${APP_URL}/signup?invite=${params.inviteCode}&role=expert`
}
