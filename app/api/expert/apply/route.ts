import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const auth = await requireRole('expert')
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const profile = await prisma.expertProfile.upsert({
    where: { id: auth.session.user.id },
    create: {
      id:              auth.session.user.id,
      bio:             body.bio,
      yearsExperience: body.yearsExperience,
      certifications:  body.certifications ?? [],
      categoryIds:     body.categoryIds ?? [],
      hourlyRate:      body.hourlyRate,
      status:          'pending',
    },
    update: {
      bio:             body.bio,
      yearsExperience: body.yearsExperience,
      certifications:  body.certifications ?? [],
      categoryIds:     body.categoryIds ?? [],
      hourlyRate:      body.hourlyRate,
      status:          'pending',
    },
  })
  return NextResponse.json(profile)
}
