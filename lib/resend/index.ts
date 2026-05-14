import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'
const APP  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

// ── Email templates ───────────────────────────────────────────

export async function sendSessionConfirmation(to: string, params: {
  customerName: string; expertName: string; categoryName: string
  sessionId: string; scheduledAt: string; totalAmount: number
}) {
  return resend.emails.send({
    from: FROM, to,
    subject: `Your session with ${params.expertName} is confirmed`,
    html: `
      <h2>Session confirmed, ${params.customerName}!</h2>
      <p>Your <strong>${params.categoryName}</strong> session with <strong>${params.expertName}</strong> is booked.</p>
      <p><strong>When:</strong> ${new Date(params.scheduledAt).toLocaleString()}</p>
      <p><strong>Total:</strong> $${params.totalAmount.toFixed(2)} (charged after session)</p>
      <p><a href="${APP}/customer/sessions/${params.sessionId}" style="background:#f97c0a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Join session</a></p>
    `,
  })
}

export async function sendExpertNewBooking(to: string, params: {
  expertName: string; customerName: string; categoryName: string
  sessionId: string; problemTitle: string; scheduledAt: string; payout: number
}) {
  return resend.emails.send({
    from: FROM, to,
    subject: `New session booked — ${params.categoryName}`,
    html: `
      <h2>New booking, ${params.expertName}!</h2>
      <p><strong>${params.customerName}</strong> needs help with: <em>${params.problemTitle}</em></p>
      <p><strong>Category:</strong> ${params.categoryName}</p>
      <p><strong>When:</strong> ${new Date(params.scheduledAt).toLocaleString()}</p>
      <p><strong>Your payout:</strong> $${params.payout.toFixed(2)}</p>
      <p><a href="${APP}/expert/sessions/${params.sessionId}" style="background:#f97c0a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">View session</a></p>
    `,
  })
}

export async function sendApplicationResult(to: string, params: {
  name: string; approved: boolean; reason?: string
}) {
  return resend.emails.send({
    from: FROM, to,
    subject: params.approved ? 'Your TightSpotHelper application is approved!' : 'Update on your TightSpotHelper application',
    html: params.approved
      ? `<h2>You're approved, ${params.name}!</h2>
         <p>Your expert application has been approved. Connect your payout account to start taking sessions.</p>
         <p><a href="${APP}/expert/apply/connect" style="background:#f97c0a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Connect payout account</a></p>`
      : `<h2>Application update, ${params.name}</h2>
         <p>Unfortunately we weren't able to approve your application at this time.</p>
         ${params.reason ? `<p><strong>Reason:</strong> ${params.reason}</p>` : ''}
         <p>Contact <a href="mailto:support@tightspothelper.com">support@tightspothelper.com</a> for more information.</p>`,
  })
}

export async function sendSessionSummary(to: string, params: {
  name: string; sessionId: string; expertName: string; notes?: string
  parts?: string[]; totalCharged: number; hasRecording: boolean; recordingExpiresAt?: string
}) {
  return resend.emails.send({
    from: FROM, to,
    subject: `Session summary — ${params.expertName}`,
    html: `
      <h2>Session complete, ${params.name}!</h2>
      ${params.notes ? `<h3>Expert notes</h3><p>${params.notes}</p>` : ''}
      ${params.parts?.length ? `<h3>Parts needed</h3><ul>${params.parts.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
      <p><strong>Charged:</strong> $${params.totalCharged.toFixed(2)}</p>
      ${params.hasRecording ? `
        <p>🎬 Your session recording is ready — expires ${params.recordingExpiresAt ? new Date(params.recordingExpiresAt).toLocaleDateString() : 'in 30 days'}.</p>
        <p><a href="${APP}/customer/sessions/${params.sessionId}/recording" style="background:#f97c0a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Watch recording</a></p>
      ` : ''}
      <p><a href="${APP}/customer/sessions/${params.sessionId}/summary">View full session summary</a></p>
    `,
  })
}

export async function sendRecordingExpiry(to: string, params: {
  name: string; sessionId: string; recordingId: string; daysLeft: number; price: number
}) {
  return resend.emails.send({
    from: FROM, to,
    subject: `Your session recording expires in ${params.daysLeft} day${params.daysLeft !== 1 ? 's' : ''}`,
    html: `
      <h2>Recording expiring soon, ${params.name}</h2>
      <p>Your session recording will be deleted in <strong>${params.daysLeft} days</strong>.</p>
      <p>Keep it forever for just <strong>$${params.price.toFixed(2)}</strong>.</p>
      <p><a href="${APP}/customer/sessions/${params.sessionId}/recording?action=keep" style="background:#f97c0a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Keep this recording · $${params.price.toFixed(2)}</a></p>
      <p style="color:#888;font-size:12px">If you don't act, the recording is permanently deleted after ${params.daysLeft} days.</p>
    `,
  })
}
