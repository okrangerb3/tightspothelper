import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { inviteCode } = await req.json()
  if (!inviteCode) return NextResponse.json({ ok: false })

  await (prisma as any).proLead.updateMany({
    where:  { inviteCode },
    data:   { status: 'registered', registeredAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
