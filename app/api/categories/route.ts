import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const categories = await prisma.category.findMany({
    where:   { active: true },
    select:  { id: true, name: true, slug: true, icon: true, feeType: true, feeValue: true, feeFlatTiers: true, rateMin: true, rateMax: true },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json({ categories })
}
