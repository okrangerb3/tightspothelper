import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId')

  const profiles = await prisma.expertProfile.findMany({
    where: {
      status:    'approved',
      available: true,
      ...(categoryId ? { categoryIds: { has: categoryId } } : {}),
    },
    include: { user: { select: { name: true } } },
  })

  const experts = profiles.map(p => ({
    id:          p.id,
    name:        p.user.name ?? 'Expert',
    hourlyRate:  p.hourlyRate,
    ratingAvg:   p.ratingAvg,
    ratingCount: p.ratingCount,
    bio:         p.bio,
  }))

  return NextResponse.json({ experts })
}
