import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  await prisma.feeOverride.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
