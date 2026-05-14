import { NextResponse } from 'next/server'
// Daily.co has been replaced with Jitsi — this webhook is no longer used.

export async function POST() {
  return NextResponse.json({ error: 'Gone' }, { status: 410 })
}

