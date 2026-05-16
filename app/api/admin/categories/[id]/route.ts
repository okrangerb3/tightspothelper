import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  const body = await req.json()
  await prisma.category.update({
    where: { id: params.id },
    data: {
      ...(name        !== undefined ? { name }        : {}),
      ...(slug        !== undefined ? { slug }        : {}),
      ...(description !== undefined ? { description } : {}),
      ...(icon        !== undefined ? { icon }        : {}),
      feeType:      body.fee_type,
      feeValue:     body.fee_value,
      feeFlatTiers: body.fee_flat_tiers,
      rateMin:      body.rate_min,
      rateMax:      body.rate_max,
      active:       body.active,
    },
  })
  return NextResponse.json({ ok: true })
}
