import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const in5days  = new Date(Date.now() + 5 * 86400000).toISOString()
  const now      = new Date().toISOString()

  // Free recordings expiring in 4–6 days that haven't been upsold yet
  const { data: recs } = await supabase.from('recordings')
    .select('id,session_id,expires_at,sessions(customer_id,expert_id,problem_title,profiles!customer_id(full_name,email:profiles(email)))')
    .eq('plan', 'free')
    .is('deleted_at', null)
    .lte('expires_at', in5days)
    .gte('expires_at', now)
    .not('id', 'in',
      // Skip already-notified
      supabase.from('notifications').select('payload->recording_id').eq('type', 'recording_upsell')
    )

  let sent = 0
  for (const rec of recs ?? []) {
    const session  = (rec as any).sessions
    const customer = session?.profiles
    if (!customer?.email) continue

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const daysLeft = Math.ceil((new Date(rec.expires_at).getTime() - Date.now()) / 86400000)

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to:   customer.email,
        subject: `Your TightSpotHelper recording expires in ${daysLeft} days`,
        html: `
          <p>Hi ${customer.full_name ?? 'there'},</p>
          <p>Your session recording for "<strong>${session.problem_title}</strong>" will be automatically deleted in ${daysLeft} days.</p>
          <p>Keep it forever for a one-time fee — or upgrade to a storage plan to save all your future sessions.</p>
          <p><a href="${appUrl}/customer/sessions/${rec.session_id}/recording?action=keep" style="background:#f97c0a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Keep this recording</a></p>
          <p style="color:#888;font-size:12px">If you don't take action, the recording will be permanently deleted on ${new Date(rec.expires_at).toLocaleDateString()}.</p>
        `,
      })

      // Log notification so we don't re-send
      await supabase.from('notifications').insert({
        user_id: session.customer_id,
        type:    'recording_upsell',
        payload: { recording_id: rec.id, session_id: rec.session_id },
        sent_at: new Date().toISOString(),
      })

      sent++
    } catch (err) {
      console.error('Upsell email failed:', err)
    }
  }

  return NextResponse.json({ sent, total: recs?.length ?? 0 })
}
