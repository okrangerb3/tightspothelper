import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  const body = await req.json()
  const { name, slug, description, icon, fee_type, fee_value, fee_flat_tiers, active } = body

  await prisma.category.update({
    where: { id: params.id },
    data: {
      ...(name        !== undefined ? { name }        : {}),
      ...(slug        !== undefined ? { slug }        : {}),
      ...(description !== undefined ? { description } : {}),
      ...(icon        !== undefined ? { icon }        : {}),
      ...(fee_type    !== undefined ? { feeType: fee_type } : {}),
      ...(fee_value   !== undefined ? { feeValue: fee_value } : {}),
      ...(fee_flat_tiers !== undefined ? { feeFlatTiers: fee_flat_tiers } : {}),
      ...(active      !== undefined ? { active } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}
