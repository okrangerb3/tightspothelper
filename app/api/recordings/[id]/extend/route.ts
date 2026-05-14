import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('admin')
  if (error) return error

  // Extend free recording by 30 more days
  const rec = await prisma.recording.findUnique({
    where:  { id: params.id },
    select: { expiresAt: true },
  })
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newExpiry = new Date((rec.expiresAt ?? new Date()).getTime() + 30 * 86400000)
  await prisma.recording.update({
    where: { id: params.id },
    data:  { expiresAt: newExpiry },
  })
  return NextResponse.json({ ok: true, expiresAt: newExpiry })
}
