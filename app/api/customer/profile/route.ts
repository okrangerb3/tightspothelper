import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const user = await prisma.authUser.findUnique({
    where: { id: auth.session.user.id },
    select: { id: true, name: true, email: true, phone: true },
  })
  return NextResponse.json({ user })
}

export async function PATCH(req: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const body = await req.json()
  const user = await prisma.authUser.update({
    where: { id: auth.session.user.id },
    data: {
      name:  body.name,
      phone: body.phone ?? null,
    },
    select: { id: true, name: true, email: true, phone: true },
  })
  return NextResponse.json({ user })
}
