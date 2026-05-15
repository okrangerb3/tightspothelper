import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const profile = await prisma.expertProfile.findUnique({
    where: { id: session.user.id },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    bio:                  profile.bio,
    yearsExperience:      profile.yearsExperience,
    certifications:       profile.certifications,
    hourlyRate:           profile.hourlyRate,
    categoryIds:          profile.categoryIds,
    available:            profile.available,
    weeklySchedule:       (profile as any).weeklySchedule ?? null,
    timezone:             (profile as any).timezone ?? 'America/Chicago',
    emergencyAvailable:   (profile as any).emergencyAvailable ?? false,
    emergencyRate:        (profile as any).emergencyRate ?? null,
    specialties:          (profile as any).specialties ?? [],
    slug:                 (profile as any).slug ?? null,
    headline:             (profile as any).headline ?? null,
    publicBio:            (profile as any).publicBio ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const {
    bio, yearsExperience, certifications, hourlyRate, categoryIds,
    available, weeklySchedule, timezone, emergencyAvailable, emergencyRate,
    specialties, headline, publicBio,
  } = body

  await prisma.expertProfile.update({
    where: { id: session.user.id },
    data: {
      ...(bio              !== undefined ? { bio }              : {}),
      ...(yearsExperience  !== undefined ? { yearsExperience }  : {}),
      ...(certifications   !== undefined ? { certifications }   : {}),
      ...(hourlyRate       !== undefined ? { hourlyRate }       : {}),
      ...(categoryIds      !== undefined ? { categoryIds }      : {}),
      ...(available        !== undefined ? { available }        : {}),
      // New fields stored as JSON/raw until schema is updated
      ...(weeklySchedule   !== undefined ? { weeklySchedule }   : {}),
      ...(timezone         !== undefined ? { timezone }         : {}),
      ...(emergencyAvailable !== undefined ? { emergencyAvailable } : {}),
      ...(emergencyRate    !== undefined ? { emergencyRate }    : {}),
      ...(specialties      !== undefined ? { specialties }      : {}),
      ...(headline         !== undefined ? { headline }         : {}),
      ...(publicBio        !== undefined ? { publicBio }        : {}),
    } as any,
  })

  return NextResponse.json({ ok: true })
}
