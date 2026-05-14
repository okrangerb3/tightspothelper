import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('admin')
  if (error) return error

  const { category_id, override_value, starts_at, ends_at } = await req.json()

  if (!category_id || override_value == null || !starts_at || !ends_at)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  if (new Date(starts_at) >= new Date(ends_at))
    return NextResponse.json({ error: 'starts_at must be before ends_at' }, { status: 400 })

  const override = await prisma.feeOverride.create({
    data: {
      categoryId:     category_id,
      overrideValue:  parseFloat(override_value),
      startsAt:       new Date(starts_at),
      endsAt:         new Date(ends_at),
      createdBy:      session.user.id,
    },
  })
  return NextResponse.json({ override })
}

export async function GET() {
  const { error } = await requireRole('admin')
  if (error) return error

  const overrides = await prisma.feeOverride.findMany({
    include:  { category: { select: { name: true } } },
    orderBy:  { startsAt: 'desc' },
  })
  return NextResponse.json({ overrides })
}
