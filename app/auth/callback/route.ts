// Supabase auth callback — no longer used with better-auth
// better-auth handles OAuth callbacks at /api/auth/callback/:provider
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.redirect('/login?error=oauth_failed')
}

