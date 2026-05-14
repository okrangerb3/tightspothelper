// Removed — project uses Jitsi + Jibri (no Daily.co)
export {}

export async function createRoom(sessionId: string) {
  const res = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `session-${sessionId}`,
      privacy: 'private',
      properties: {
        enable_recording: 'cloud',        // Daily.co cloud recording
        recording_type: 'cloud',
        max_participants: 2,
        enable_chat: true,
        enable_screenshare: true,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4, // 4hr expiry
        eject_at_room_exp: true,
      },
    }),
  })
  if (!res.ok) throw new Error(`Daily room creation failed: ${await res.text()}`)
  return res.json() as Promise<{ name: string; url: string; id: string }>
}

export async function createMeetingToken(roomName: string, userId: string, isExpert: boolean) {
  const res = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_id: userId,
        is_owner: isExpert,  // expert is room owner — can end session for all
        enable_recording: isExpert ? 'cloud' : false,
        start_cloud_recording: false, // recording starts via API, not auto
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
      },
    }),
  })
  if (!res.ok) throw new Error(`Daily token creation failed: ${await res.text()}`)
  return res.json() as Promise<{ token: string }>
}

export async function startRecording(roomName: string) {
  const res = await fetch(`${DAILY_API}/recordings/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ room_name: roomName }),
  })
  if (!res.ok) throw new Error(`Failed to start recording: ${await res.text()}`)
  return res.json()
}

export async function deleteRoom(roomName: string) {
  await fetch(`${DAILY_API}/rooms/${roomName}`, { method: 'DELETE', headers })
}

/** Verify Daily.co webhook signature */
export function verifyDailyWebhook(payload: string, signature: string): boolean {
  const crypto = require('crypto')
  const expected = crypto
    .createHmac('sha256', process.env.DAILY_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
