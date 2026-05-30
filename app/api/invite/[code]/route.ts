import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/invite/[code] — validates invite and redirects to signup
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const lead = await (prisma as any).proLead.findFirst({
    where: { inviteCode: params.code },
  })

  if (!lead) {
    return NextResponse.redirect(
      new URL('/signup?role=expert', process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com')
    )
  }

  // Mark as clicked
  await (prisma as any).proLead.update({
    where: { id: lead.id },
    data:  { status: 'clicked', clickedAt: new Date() },
  })

  // Redirect to signup with pre-filled data
  const url = new URL('/signup', process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com')
  url.searchParams.set('role', 'expert')
  url.searchParams.set('invite', params.code)
  url.searchParams.set('category', lead.categoryId)

  return NextResponse.redirect(url)
}
