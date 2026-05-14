import { NextRequest, NextResponse } from 'next/server'
import { verifyDailyWebhook } from '@/lib/daily'
import { storeRecordingFromUrl, keys } from '@/lib/r2'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const signature = req.headers.get('x-daily-signature') ?? ''

  if (!verifyDailyWebhook(payload, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(payload)
  const supabase = createAdminClient()

  // ── recording.ready ───────────────────────────────────────
  if (event.type === 'recording.ready-to-download') {
    const { recording_id, room_name, download_url, duration, s3bucket } = event.payload

    // Find the session by Daily room name
    const { data: session } = await supabase
      .from('sessions')
      .select('id, customer_id, expert_id')
      .eq('daily_room_name', room_name)
      .single()

    if (!session) {
      console.error('Session not found for room:', room_name)
      return NextResponse.json({ ok: false }, { status: 404 })
    }

    try {
      // Store user-accessible copy and admin master copy in R2
      const userKey  = keys.recording(session.id)
      const adminKey = keys.recordingAdmin(session.id)

      const sizeBytes = await storeRecordingFromUrl(download_url, userKey)
      await storeRecordingFromUrl(download_url, adminKey)

      const durationMinutes = Math.ceil(duration / 60)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

      // Create recording record
      const { data: recording } = await supabase
        .from('recordings')
        .insert({
          session_id:       session.id,
          r2_key:           userKey,
          r2_admin_key:     adminKey,
          duration_seconds: duration,
          size_bytes:       sizeBytes,
          plan:             'free',
          expires_at:       expiresAt.toISOString(),
        })
        .select()
        .single()

      // Notify both parties
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      await supabase.from('notifications').insert([
        {
          user_id: session.customer_id,
          type: 'recording_ready',
          payload: { recording_id: recording?.id, session_id: session.id,
                     expires_at: expiresAt.toISOString(),
                     view_url: `${appUrl}/customer/sessions/${session.id}/recording` }
        },
        {
          user_id: session.expert_id,
          type: 'recording_ready',
          payload: { recording_id: recording?.id, session_id: session.id,
                     expires_at: expiresAt.toISOString(),
                     view_url: `${appUrl}/expert/sessions/${session.id}/recording` }
        },
      ])

      console.log(`Recording stored for session ${session.id}`)
    } catch (err) {
      console.error('Recording storage error:', err)
      return NextResponse.json({ error: 'Storage failed' }, { status: 500 })
    }
  }

  // ── meeting.ended ─────────────────────────────────────────
  if (event.type === 'meeting.ended') {
    const { room_name, duration } = event.payload
    await supabase
      .from('sessions')
      .update({
        status:           'completed',
        ended_at:         new Date().toISOString(),
        duration_seconds: duration,
        duration_billed_minutes: Math.ceil(duration / 60 / 15) * 15, // round up to 15-min block
      })
      .eq('daily_room_name', room_name)
  }

  return NextResponse.json({ ok: true })
}
