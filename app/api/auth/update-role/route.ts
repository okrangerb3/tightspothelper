// POST /api/auth/update-role — sets the role for a newly signed-up user.
// Called from the signup page after better-auth registers the user.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const Schema = z.object({ role: z.enum(['customer', 'expert']) })

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  // Only allow setting role if it's still the default 'customer'
  const user = await prisma.authUser.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await prisma.authUser.update({
    where: { id: session.user.id },
    data:  { role: parsed.data.role as any },
  })

  return NextResponse.json({ ok: true })
}
