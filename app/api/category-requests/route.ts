import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/resend'

const FROM    = process.env.RESEND_FROM_EMAIL ?? 'noreply@tightspothelper.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@tightspothelper.com'

// POST — customer submits a category request
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { categoryName, description } = await req.json()
  if (!categoryName?.trim()) {
    return NextResponse.json({ error: 'Category name required' }, { status: 400 })
  }

  // Save request to DB
  const request = await (prisma as any).categoryRequest.create({
    data: {
      userId:       session.user.id,
      categoryName: categoryName.trim(),
      description:  description?.trim() ?? null,
      status:       'pending',
    },
  })

  // Alert admin
  await resend.emails.send({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: `New category request: ${categoryName}`,
    html: `
      <h2>New category request</h2>
      <p><strong>Category:</strong> ${categoryName}</p>
      ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
      <p><strong>From:</strong> ${session.user.email}</p>
      <p><a href="${APP_URL}/admin/category-requests">Review in admin panel →</a></p>
    `,
  }).catch(console.error)

  // Find pros with matching specialties and alert them
  const matchingPros = await prisma.expertProfile.findMany({
    where: {
      status:    'approved',
      available: true,
      OR: [
        { specialties: { has: categoryName } },
        // Also match partial — check categories table
      ],
    },
    include: { user: { select: { email: true, name: true } } },
    take: 50,
  })

  // Notify matching pros in background
  if (matchingPros.length > 0) {
    Promise.allSettled(
      matchingPros.map(pro =>
        resend.emails.send({
          from:    FROM,
          to:      pro.user.email,
          subject: `New service request: ${categoryName}`,
          html: `
            <h2>A customer is looking for help with: ${categoryName}</h2>
            <p>Hi ${pro.user.name ?? 'there'},</p>
            <p>A customer on TightSpotHelper is looking for an expert in <strong>${categoryName}</strong>.</p>
            ${description ? `<p>They described it as: <em>${description}</em></p>` : ''}
            <p>If this is in your wheelhouse, make sure your profile is up to date and available.</p>
            <p><a href="${APP_URL}/expert/profile" style="background:#f97c0a;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Update my profile →</a></p>
          `,
        })
      )
    ).catch(console.error)
  }

  return NextResponse.json({ ok: true, requestId: request.id, prosNotified: matchingPros.length })
}

// GET — admin views all requests
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await (prisma as any).categoryRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  })

  return NextResponse.json({ requests })
}

// PATCH — admin approves/dismisses a request
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, status, adminNote } = await req.json()
  await (prisma as any).categoryRequest.update({
    where: { id },
    data:  { status, adminNote },
  })

  return NextResponse.json({ ok: true })
}
