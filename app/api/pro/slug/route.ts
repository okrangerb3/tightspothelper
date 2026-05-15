import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let i = 1
  while (await prisma.expertProfile.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`
  }
  return slug
}

// GET — return current slug (or generate one)
export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const profile = await prisma.expertProfile.findUnique({
    where:  { id: session.user.id },
    select: { slug: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  // Return ID as fallback slug so public link always works
  return NextResponse.json({ slug: profile.slug ?? session.user.id })
}

// POST — generate or set a custom slug
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: { name: true },
  })

  const body = await req.json().catch(() => ({}))
  const requested = body.slug ? toSlug(body.slug) : toSlug(user?.name ?? 'expert')
  if (!requested) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

  const slug = await uniqueSlug(requested)

  const profile = await prisma.expertProfile.update({
    where: { id: session.user.id },
    data:  { slug },
    select: { slug: true },
  })

  return NextResponse.json({ slug: profile.slug })

// Always return current slug or ID as fallback
}
