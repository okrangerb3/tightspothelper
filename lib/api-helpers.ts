// Shared auth helpers for API route handlers.
// Usage:
//   const { session, error } = await requireAuth()
//   if (error) return error

import { auth } from './auth'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export type AuthUser = {
  id:    string
  email: string
  name:  string
  role:  string
}

export async function getSession(): Promise<{ user: AuthUser } | null> {
  const session = await auth.api.getSession({ headers: headers() })
  return session as any ?? null
}

export async function requireAuth(): Promise<
  | { session: { user: AuthUser }; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getSession()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function requireRole(role: string | string[]): Promise<
  | { session: { user: AuthUser }; error: null }
  | { session: null; error: NextResponse }
> {
  const { session, error } = await requireAuth()
  if (error || !session) return { session: null, error: error! }

  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(session.user.role)) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, error: null }
}
