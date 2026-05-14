import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendRecordingExpiry } from '@/lib/resend'
import { recordingPrice } from '@/lib/r2'

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const in5days  = new Date(Date.now() + 5 * 86400000).toISOString()
  const now      = new Date().toISOString()

  // Fetch recording IDs already upsold so we can exclude them
  const { data: alreadySent } = await supabase
    .from('notifications')
    .select('payload')
    .eq('type', 'recording_upsell')

  const alreadySentIds: string[] = (alreadySent ?? [])
    .map((n) => (n.payload as any)?.recording_id)
    .filter(Boolean)

  // Free recordings expiring in the next 5 days that haven't been upsold yet
  let query = supabase
    .from('recordings')
    .select('id,session_id,expires_at,duration_seconds,sessions(customer_id,problem_title,profiles!customer_id(full_name))')
    .eq('plan', 'free')
    .is('deleted_at', null)
    .lte('expires_at', in5days)
    .gte('expires_at', now)

  if (alreadySentIds.length > 0) {
    query = query.not('id', 'in', `(${alreadySentIds.map(id => `"${id}"`).join(',')})`)
  }

  const { data: recs } = await query

  let sent = 0
  for (const rec of recs ?? []) {
    const session  = (rec as any).sessions
    const customer = session?.profiles
    const email    = customer?.email as string | undefined
    if (!email) continue

    const daysLeft = Math.ceil((new Date(rec.expires_at).getTime() - Date.now()) / 86400000)
    const durationMinutes = Math.ceil(((rec as any).duration_seconds ?? 0) / 60)
    const price = recordingPrice(durationMinutes)

    try {
      await sendRecordingExpiry(email, {
        name:        customer.full_name ?? 'there',
        sessionId:   rec.session_id,
        recordingId: rec.id,
        daysLeft,
        price,
      })

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
