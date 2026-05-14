import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireRole('expert')
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const profile = await prisma.expertProfile.findUnique({
    where: { id: auth.session.user.id },
  })
  return NextResponse.json(profile)
}

export async function PATCH(req: Request) {
  const auth = await requireRole('expert')
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const profile = await prisma.expertProfile.update({
    where: { id: auth.session.user.id },
    data: {
      bio:             body.bio,
      yearsExperience: body.yearsExperience,
      certifications:  body.certifications,
      hourlyRate:      body.hourlyRate,
      available:       body.available,
    },
  })
  return NextResponse.json(profile)
}
