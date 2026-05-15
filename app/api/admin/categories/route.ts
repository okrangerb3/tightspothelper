import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, slug, description, icon, fee_type, fee_value, active } = await req.json()

  if (!name?.trim() || !slug?.trim())
    return NextResponse.json({ error: 'Name and slug required' }, { status: 400 })

  // Check for duplicate
  const existing = await prisma.category.findFirst({
    where: { OR: [{ name }, { slug }] },
  })
  if (existing)
    return NextResponse.json({ error: 'Category name or slug already exists' }, { status: 409 })

  const category = await prisma.category.create({
    data: {
      name,
      slug,
      description:  description ?? null,
      icon:         icon ?? null,
      feeType:      fee_type ?? 'percentage',
      feeValue:     fee_value ?? 0.20,
      active:       active ?? true,
      sortOrder:    999,
    },
  })

  return NextResponse.json({ category })
}
