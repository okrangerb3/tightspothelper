import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { firstName, lastName, city, state, zip, phone } = body

  // Build the combined name
  const name = [firstName, lastName].filter(Boolean).join(' ') || undefined

  await prisma.authUser.update({
    where: { id: session.user.id },
    data: {
      ...(name      ? { name }      : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName  ? { lastName }  : {}),
      ...(city      !== undefined ? { city }  : {}),
      ...(state     !== undefined ? { state } : {}),
      ...(zip       !== undefined ? { zip }   : {}),
      ...(phone     !== undefined ? { phone } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: {
      id: true, name: true, email: true, phone: true,
      firstName: true, lastName: true,
      city: true, state: true, zip: true,
      emailVerified: true,
    },
  })

  return NextResponse.json({ user })
}
