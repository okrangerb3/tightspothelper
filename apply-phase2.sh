#!/usr/bin/env bash
# TightSpotHelper — Phase 2 feature pack
# Run from the root of the tightspothelper repo:
#   bash apply-phase2.sh
set -e

if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run this from the root of the tightspothelper repo." >&2; exit 1
fi

mkdir -p \
  prisma/migrations/20260515000001_user_profile_slug \
  app/pro/\[slug\] \
  "app/(admin)/admin/customers" \
  "app/(admin)/admin/financials" \
  "app/(customer)/customer/profile" \
  app/api/profile \
  app/api/pro/slug

echo '→ writing prisma/migrations/20260515000001_user_profile_slug/migration.sql'
cat > 'prisma/migrations/20260515000001_user_profile_slug/migration.sql' << 'TSH_EOF_MARKER'
-- Add extended profile fields to auth_users
ALTER TABLE "auth_users"
  ADD COLUMN IF NOT EXISTS "firstName"  TEXT,
  ADD COLUMN IF NOT EXISTS "lastName"   TEXT,
  ADD COLUMN IF NOT EXISTS "city"       TEXT,
  ADD COLUMN IF NOT EXISTS "state"      TEXT,
  ADD COLUMN IF NOT EXISTS "zip"        TEXT;

-- Add public slug to expert_profiles (for /pro/[slug] pages)
ALTER TABLE "expert_profiles"
  ADD COLUMN IF NOT EXISTS "slug"        TEXT,
  ADD COLUMN IF NOT EXISTS "headline"    TEXT,
  ADD COLUMN IF NOT EXISTS "publicBio"   TEXT;

-- Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS "expert_profiles_slug_key" ON "expert_profiles"("slug");

-- Backfill firstName/lastName from existing name field (best-effort split)
UPDATE "auth_users"
SET
  "firstName" = split_part("name", ' ', 1),
  "lastName"  = CASE
    WHEN strpos("name", ' ') > 0
    THEN substring("name" FROM strpos("name", ' ') + 1)
    ELSE NULL
  END
WHERE "firstName" IS NULL AND "name" IS NOT NULL AND "name" != '';
TSH_EOF_MARKER

echo '→ writing app/sitemap.ts'
cat > 'app/sitemap.ts' << 'TSH_EOF_MARKER'
import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/login`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/signup`,  lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]

  // Category pages
  let categoryPages: MetadataRoute.Sitemap = []
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
    })
    categoryPages = categories.map(c => ({
      url:              `${BASE_URL}/services/${c.slug}`,
      lastModified:     c.updatedAt,
      changeFrequency:  'weekly' as const,
      priority:         0.8,
    }))
  } catch {}

  // Pro public profiles
  let proPages: MetadataRoute.Sitemap = []
  try {
    const pros = await prisma.expertProfile.findMany({
      where: { status: 'approved', slug: { not: null } },
      select: { slug: true, updatedAt: true },
    })
    proPages = pros
      .filter(p => p.slug)
      .map(p => ({
        url:             `${BASE_URL}/pro/${p.slug}`,
        lastModified:    p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority:        0.7,
      }))
  } catch {}

  return [...staticPages, ...categoryPages, ...proPages]
}
TSH_EOF_MARKER

echo '→ writing app/robots.ts'
cat > 'app/robots.ts' << 'TSH_EOF_MARKER'
import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pro/', '/services/'],
        disallow: ['/admin/', '/customer/', '/expert/', '/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
TSH_EOF_MARKER

echo '→ writing app/pro/[slug]/page.tsx'
cat > 'app/pro/[slug]/page.tsx' << 'TSH_EOF_MARKER'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

interface Props { params: { slug: string } }

async function getPro(slug: string) {
  return prisma.expertProfile.findUnique({
    where:   { slug },
    include: { user: { select: { name: true, image: true } } },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pro = await getPro(params.slug)
  if (!pro) return { title: 'Expert not found' }
  const name = pro.user.name ?? 'Expert'
  return {
    title:       `${name} — TightSpotHelper Expert`,
    description: pro.publicBio ?? pro.bio ?? `Book a remote session with ${name} on TightSpotHelper.`,
    openGraph: {
      title:       `${name} — TightSpotHelper`,
      description: pro.publicBio ?? pro.bio ?? '',
      url:         `${BASE_URL}/pro/${params.slug}`,
      type:        'profile',
    },
    twitter: {
      card:        'summary',
      title:       `${name} — TightSpotHelper`,
      description: pro.publicBio ?? pro.bio ?? '',
    },
  }
}

export default async function ProPublicProfile({ params }: Props) {
  const pro = await getPro(params.slug)
  if (!pro || pro.status !== 'approved') notFound()

  const name       = pro.user.name ?? 'Expert'
  const initials   = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const rate       = Number(pro.hourlyRate ?? 0)
  const rating     = Number(pro.ratingAvg ?? 0)

  // Get category names
  const categories = pro.categoryIds.length
    ? await prisma.category.findMany({
        where:  { id: { in: pro.categoryIds } },
        select: { name: true, slug: true, icon: true },
      })
    : []

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Nav */}
      <nav className="border-b border-ink-800 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="font-display font-bold text-white text-lg">
          TightSpot<span className="text-brand-500">Helper</span>
        </Link>
        <div className="flex gap-3">
          <Link href="/login"  className="btn-ghost text-sm">Log in</Link>
          <Link href="/signup" className="btn-primary text-sm">Get help</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="card p-8 mb-6">
          <div className="flex items-start gap-6">
            {pro.user.image ? (
              <img src={pro.user.image} alt={name}
                className="w-20 h-20 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-500/20 border border-brand-500/30
                flex items-center justify-center text-2xl font-bold text-brand-400 shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-white">{name}</h1>
              {pro.headline && (
                <p className="text-ink-400 mt-1">{pro.headline}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-3">
                {rating > 0 && (
                  <span className="text-sm text-yellow-400">
                    {'★'.repeat(Math.round(rating))} {rating.toFixed(1)}
                    <span className="text-ink-500 ml-1">({pro.ratingCount} reviews)</span>
                  </span>
                )}
                {rate > 0 && (
                  <span className="text-sm font-medium text-brand-400">${rate}/hr</span>
                )}
                {pro.yearsExperience && (
                  <span className="text-sm text-ink-400">{pro.yearsExperience} yrs experience</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  pro.available
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-ink-800 text-ink-500 border border-ink-700'
                }`}>
                  {pro.available ? '● Available now' : '○ Unavailable'}
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          {pro.available && (
            <Link href={`/signup?bookPro=${pro.id}`}
              className="btn-primary w-full mt-6 text-center block">
              Book a session with {name.split(' ')[0]}
            </Link>
          )}
        </div>

        {/* About */}
        {(pro.publicBio ?? pro.bio) && (
          <div className="card p-6 mb-6">
            <h2 className="font-display text-sm font-bold text-white mb-3">About</h2>
            <p className="text-ink-300 leading-relaxed text-sm whitespace-pre-line">
              {pro.publicBio ?? pro.bio}
            </p>
          </div>
        )}

        {/* Specialties */}
        {categories.length > 0 && (
          <div className="card p-6 mb-6">
            <h2 className="font-display text-sm font-bold text-white mb-3">Specialties</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <span key={c.slug}
                  className="px-3 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-sm text-ink-200">
                  {c.icon && <span className="mr-1.5">{c.icon}</span>}{c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {pro.certifications.length > 0 && (
          <div className="card p-6 mb-6">
            <h2 className="font-display text-sm font-bold text-white mb-3">Certifications</h2>
            <ul className="space-y-1.5">
              {pro.certifications.map((cert, i) => (
                <li key={i} className="text-sm text-ink-300 flex items-center gap-2">
                  <span className="text-brand-400">✓</span> {cert}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Share */}
        <div className="card p-4 flex items-center gap-3">
          <p className="text-xs text-ink-500 flex-1">Share this profile</p>
          <button
            onClick={() => navigator.clipboard.writeText(`${BASE_URL}/pro/${params.slug}`)}
            className="btn-ghost text-xs">
            Copy link
          </button>
        </div>
      </main>
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/api/pro/slug/route.ts'
cat > 'app/api/pro/slug/route.ts' << 'TSH_EOF_MARKER'
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
  return NextResponse.json({ slug: profile.slug })
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
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/customers/page.tsx'
cat > 'app/(admin)/admin/customers/page.tsx' << 'TSH_EOF_MARKER'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export const metadata = { title: 'Customer Management — TightSpotHelper Admin' }

export default async function AdminCustomers({
  searchParams,
}: {
  searchParams: { q?: string; page?: string }
}) {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const q    = searchParams.q ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const take = 25
  const skip = (page - 1) * take

  const where = q
    ? {
        role: 'customer' as const,
        OR: [
          { name:  { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : { role: 'customer' as const }

  const [customers, total] = await Promise.all([
    prisma.authUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true, name: true, email: true, phone: true,
        createdAt: true, emailVerified: true, stripeCustomerId: true,
        customerSessions: {
          select: { customerTotal: true, status: true },
        },
      },
    }),
    prisma.authUser.count({ where }),
  ])

  const pages = Math.ceil(total / take)

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Customers</h1>
        <span className="text-sm text-ink-500">{total} total</span>
      </div>

      {/* Search */}
      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="input w-full max-w-sm"
        />
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-800">
            <tr className="text-left text-xs text-ink-500">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
              <th className="px-4 py-3 font-medium">Total spent</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/50">
            {customers.map(c => {
              const spent    = c.customerSessions
                .filter(s => s.status === 'completed')
                .reduce((sum, s) => sum + Number(s.customerTotal ?? 0), 0)
              const sessions = c.customerSessions.length

              return (
                <tr key={c.id} className="hover:bg-ink-900/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`}
                      className="font-medium text-white hover:text-brand-400 transition-colors">
                      {c.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-400">{c.email}</td>
                  <td className="px-4 py-3 text-ink-400">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-300">{sessions}</td>
                  <td className="px-4 py-3 text-brand-400">${spent.toFixed(2)}</td>
                  <td className="px-4 py-3 text-ink-500 text-xs">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      c.emailVerified
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    }`}>
                      {c.emailVerified ? 'verified' : 'unverified'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {customers.length === 0 && (
          <p className="text-center text-ink-500 text-sm py-12">No customers found</p>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2 mt-4 justify-end">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`?q=${q}&page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded text-xs
                ${p === page
                  ? 'bg-brand-500 text-white'
                  : 'bg-ink-800 text-ink-400 hover:bg-ink-700'}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/(admin)/admin/financials/page.tsx'
cat > 'app/(admin)/admin/financials/page.tsx' << 'TSH_EOF_MARKER'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export const metadata = { title: 'Financials — TightSpotHelper Admin' }

function fmt(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export default async function AdminFinancials() {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/customer/dashboard')

  const now        = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLast    = new Date(now.getFullYear(), now.getMonth(), 0)

  const [
    allCompleted,
    thisMonth,
    lastMonth,
    recentSessions,
    pendingPayouts,
    topExperts,
  ] = await Promise.all([
    // All-time revenue
    prisma.session.aggregate({
      where:  { status: 'completed' },
      _sum:   { platformFeeAmount: true, customerTotal: true, expertPayout: true },
      _count: { id: true },
    }),
    // This month
    prisma.session.aggregate({
      where: { status: 'completed', createdAt: { gte: startOfMonth } },
      _sum:  { platformFeeAmount: true, customerTotal: true },
    }),
    // Last month
    prisma.session.aggregate({
      where: { status: 'completed', createdAt: { gte: startOfLast, lte: endOfLast } },
      _sum:  { platformFeeAmount: true, customerTotal: true },
    }),
    // Recent completed sessions
    prisma.session.findMany({
      where:   { status: 'completed' },
      include: {
        customer: { select: { name: true } },
        expert:   { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { endedAt: 'desc' },
      take:    15,
    }),
    // Pending payouts (sessions completed but payout not released)
    prisma.session.findMany({
      where:   { status: 'completed', paymentStatus: 'held' },
      include: { expert: { select: { name: true } } },
      orderBy: { endedAt: 'asc' },
      take:    10,
    }),
    // Top earning experts
    prisma.session.groupBy({
      by:     ['expertId'],
      where:  { status: 'completed' },
      _sum:   { expertPayout: true },
      _count: { id: true },
      orderBy: { _sum: { expertPayout: 'desc' } },
      take:   10,
    }),
  ])

  // Fetch expert names for top earners
  const expertIds = topExperts.map(e => e.expertId).filter(Boolean) as string[]
  const expertNames = await prisma.authUser.findMany({
    where:  { id: { in: expertIds } },
    select: { id: true, name: true },
  })
  const nameMap = Object.fromEntries(expertNames.map(e => [e.id, e.name]))

  const allTimePlatformRevenue = Number(allCompleted._sum.platformFeeAmount ?? 0)
  const allTimeGMV             = Number(allCompleted._sum.customerTotal ?? 0)
  const allTimePayouts         = Number(allCompleted._sum.expertPayout ?? 0)
  const thisMonthRevenue       = Number(thisMonth._sum.platformFeeAmount ?? 0)
  const lastMonthRevenue       = Number(lastMonth._sum.platformFeeAmount ?? 0)
  const growth = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
    : null

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <h1 className="font-display text-2xl font-bold text-white">Financials</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'All-time platform revenue', value: fmt(allTimePlatformRevenue), accent: true },
          { label: 'All-time GMV',              value: fmt(allTimeGMV) },
          { label: 'All-time expert payouts',   value: fmt(allTimePayouts) },
          { label: 'Total sessions',            value: allCompleted._count.id.toString() },
        ].map(k => (
          <div key={k.label} className={`card p-5 ${k.accent ? 'border-brand-500/30' : ''}`}>
            <p className="text-xs text-ink-500 mb-1">{k.label}</p>
            <p className={`font-display text-2xl font-bold ${k.accent ? 'text-brand-400' : 'text-white'}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Month comparison */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-display text-sm font-bold text-white mb-4">Monthly revenue</h2>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-ink-500 mb-1">This month</p>
              <p className="text-2xl font-bold text-white">{fmt(thisMonthRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500 mb-1">Last month</p>
              <p className="text-2xl font-bold text-ink-400">{fmt(lastMonthRevenue)}</p>
            </div>
            {growth !== null && (
              <div>
                <p className="text-xs text-ink-500 mb-1">Growth</p>
                <p className={`text-2xl font-bold ${Number(growth) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(growth) >= 0 ? '+' : ''}{growth}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pending payouts */}
        <div className="card p-6">
          <h2 className="font-display text-sm font-bold text-white mb-4">
            Pending payouts
            {pendingPayouts.length > 0 && (
              <span className="ml-2 text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">
                {pendingPayouts.length}
              </span>
            )}
          </h2>
          {pendingPayouts.length === 0 ? (
            <p className="text-sm text-ink-500">All payouts released ✓</p>
          ) : (
            <div className="space-y-2">
              {pendingPayouts.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-300">{s.expert?.name ?? 'Unknown'}</span>
                  <span className="text-brand-400">{fmt(Number(s.expertPayout ?? 0))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top experts by earnings */}
      <div className="card p-6">
        <h2 className="font-display text-sm font-bold text-white mb-4">Top experts by earnings</h2>
        <div className="space-y-2">
          {topExperts.map((e, i) => (
            <div key={e.expertId ?? i} className="flex items-center gap-4">
              <span className="text-xs text-ink-600 w-4">{i + 1}</span>
              <span className="flex-1 text-sm text-ink-200">
                {nameMap[e.expertId ?? ''] ?? 'Unknown'}
              </span>
              <span className="text-xs text-ink-500">{e._count.id} sessions</span>
              <span className="text-sm font-medium text-brand-400">
                {fmt(Number(e._sum.expertPayout ?? 0))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-ink-800">
          <h2 className="font-display text-sm font-bold text-white">Recent transactions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-ink-800">
            <tr className="text-left text-xs text-ink-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer → Expert</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">GMV</th>
              <th className="px-4 py-3 font-medium">Platform fee</th>
              <th className="px-4 py-3 font-medium">Expert payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/50">
            {recentSessions.map(s => (
              <tr key={s.id} className="hover:bg-ink-900/40 transition-colors">
                <td className="px-4 py-3 text-ink-500 text-xs">
                  {s.endedAt ? new Date(s.endedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-ink-300 text-xs">
                  {s.customer?.name ?? '?'} → {s.expert?.name ?? '?'}
                </td>
                <td className="px-4 py-3 text-ink-400 text-xs">{s.category?.name ?? '—'}</td>
                <td className="px-4 py-3 text-white">{fmt(Number(s.customerTotal ?? 0))}</td>
                <td className="px-4 py-3 text-brand-400">{fmt(Number(s.platformFeeAmount ?? 0))}</td>
                <td className="px-4 py-3 text-green-400">{fmt(Number(s.expertPayout ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/api/profile/route.ts'
cat > 'app/api/profile/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { firstName, lastName, city, state, zip, phone } = body

  // Build the combined name
  const name = [firstName, lastName].filter(Boolean).join(' ') || undefined

  await prisma.authUser.update({
    where: { id: session.user.id },
    data: {
      ...(name      ? { name }      : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName  ? { lastName }  : {}),
      ...(city      !== undefined ? { city }  : {}),
      ...(state     !== undefined ? { state } : {}),
      ...(zip       !== undefined ? { zip }   : {}),
      ...(phone     !== undefined ? { phone } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const user = await prisma.authUser.findUnique({
    where:  { id: session.user.id },
    select: {
      id: true, name: true, email: true, phone: true,
      firstName: true, lastName: true,
      city: true, state: true, zip: true,
      emailVerified: true,
    },
  })

  return NextResponse.json({ user })
}
TSH_EOF_MARKER

echo '→ writing app/(customer)/customer/profile/page.tsx'
cat > 'app/(customer)/customer/profile/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export default function CustomerProfilePage() {
  const router = useRouter()
  const [form, setForm]     = useState({
    firstName: '', lastName: '', email: '', phone: '', city: '', state: '', zip: '',
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        const u = d.user ?? {}
        const [fn, ...rest] = (u.name ?? '').split(' ')
        setForm({
          firstName: u.firstName ?? fn ?? '',
          lastName:  u.lastName  ?? rest.join(' ') ?? '',
          email:     u.email  ?? '',
          phone:     u.phone  ?? '',
          city:      u.city   ?? '',
          state:     u.state  ?? '',
          zip:       u.zip    ?? '',
        })
        setLoading(false)
      })
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(false)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="p-8 max-w-xl">
      <div className="h-8 bg-ink-800 rounded animate-pulse mb-6 w-48" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-ink-800 rounded animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-xl">
      <h1 className="font-display text-2xl font-bold text-white mb-8">My profile</h1>

      <div className="card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-400 mb-1.5">First name</label>
            <input value={form.firstName} onChange={set('firstName')}
              className="input w-full" placeholder="Jane" />
          </div>
          <div>
            <label className="block text-xs text-ink-400 mb-1.5">Last name</label>
            <input value={form.lastName} onChange={set('lastName')}
              className="input w-full" placeholder="Smith" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-ink-400 mb-1.5">Email address (username)</label>
          <input value={form.email} disabled
            className="input w-full opacity-50 cursor-not-allowed" />
          <p className="text-[10px] text-ink-600 mt-1">
            Email is your username — contact support to change it
          </p>
        </div>

        <div>
          <label className="block text-xs text-ink-400 mb-1.5">Phone number</label>
          <input value={form.phone} onChange={set('phone')} type="tel"
            className="input w-full" placeholder="+1 (555) 000-0000" />
        </div>

        <div>
          <label className="block text-xs text-ink-400 mb-1.5">City</label>
          <input value={form.city} onChange={set('city')}
            className="input w-full" placeholder="Houston" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-400 mb-1.5">State</label>
            <select value={form.state} onChange={set('state')} className="input w-full">
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-400 mb-1.5">ZIP code</label>
            <input value={form.zip} onChange={set('zip')}
              className="input w-full" placeholder="77001" maxLength={10} />
          </div>
        </div>

        {error   && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">Profile saved ✓</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/(auth)/signup/page.tsx'
cat > 'app/(auth)/signup/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

type Step = 'account' | 'verify' | 'billing' | 'done'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep]     = useState<Step>('account')
  const [role, setRole]     = useState<'customer' | 'expert'>('customer')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    phone: '', city: '', state: '', zip: '',
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSignup = async () => {
    setLoading(true); setError(null)
    if (!form.firstName || !form.email || !form.password) {
      setError('Please fill in all required fields'); setLoading(false); return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); setLoading(false); return
    }

    const name = [form.firstName, form.lastName].filter(Boolean).join(' ')
    const res  = await authClient.signUp.email({
      email:    form.email,
      password: form.password,
      name,
      callbackURL: '/customer/dashboard',
    })

    if (res.error) { setError(res.error.message ?? 'Signup failed'); setLoading(false); return }

    // Save extended profile fields
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName, lastName: form.lastName,
        phone: form.phone, city: form.city, state: form.state, zip: form.zip,
      }),
    })

    setStep('verify')
    setLoading(false)
  }

  const handleResendVerification = async () => {
    setLoading(true)
    await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email }),
    })
    setLoading(false)
  }

  const handleSkipToBilling = () => setStep('billing')

  const handleSetupBilling = async () => {
    router.push('/customer/payment-methods?onboarding=1')
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="font-display font-bold text-white text-xl">
            TightSpot<span className="text-brand-500">Helper</span>
          </Link>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(['account', 'verify', 'billing'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${step === s || (step === 'done' && i < 3)
                  ? 'bg-brand-500 text-white'
                  : ['account','verify','billing'].indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-ink-800 text-ink-500'}`}>
                {['account','verify','billing'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${step === s ? 'text-white' : 'text-ink-600'} hidden sm:block`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-ink-800" />}
            </div>
          ))}
        </div>

        {/* Step 1: Account */}
        {step === 'account' && (
          <div className="card p-6 space-y-4">
            <h1 className="font-display text-xl font-bold text-white">Create your account</h1>

            {/* Role picker */}
            <div className="grid grid-cols-2 gap-2">
              {(['customer', 'expert'] as const).map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-colors
                    ${role === r
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-ink-700 text-ink-400 hover:border-ink-600'}`}>
                  {r === 'customer' ? '🏠 Get help' : '🛠️ Be an expert'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-400 mb-1.5">First name *</label>
                <input value={form.firstName} onChange={set('firstName')}
                  className="input w-full" placeholder="Jane" autoFocus />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1.5">Last name</label>
                <input value={form.lastName} onChange={set('lastName')}
                  className="input w-full" placeholder="Smith" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-1.5">Email address (your username) *</label>
              <input value={form.email} onChange={set('email')} type="email"
                className="input w-full" placeholder="jane@example.com" />
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-1.5">Password *</label>
              <input value={form.password} onChange={set('password')} type="password"
                className="input w-full" placeholder="Min. 8 characters" />
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-1.5">Phone number</label>
              <input value={form.phone} onChange={set('phone')} type="tel"
                className="input w-full" placeholder="+1 (555) 000-0000" />
            </div>

            <div>
              <label className="block text-xs text-ink-400 mb-1.5">City</label>
              <input value={form.city} onChange={set('city')}
                className="input w-full" placeholder="Houston" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-400 mb-1.5">State</label>
                <select value={form.state} onChange={set('state')} className="input w-full">
                  <option value="">State</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1.5">ZIP code</label>
                <input value={form.zip} onChange={set('zip')}
                  className="input w-full" placeholder="77001" maxLength={10} />
              </div>
            </div>

            {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

            <button onClick={handleSignup} disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account →'}
            </button>

            <p className="text-center text-xs text-ink-500">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-400 hover:text-brand-300">Log in</Link>
            </p>
          </div>
        )}

        {/* Step 2: Email verification */}
        {step === 'verify' && (
          <div className="card p-6 text-center space-y-5">
            <div className="text-4xl">📧</div>
            <h2 className="font-display text-xl font-bold text-white">Check your email</h2>
            <p className="text-sm text-ink-400">
              We sent a verification link to <span className="text-white">{form.email}</span>.
              Click it to verify your account and continue.
            </p>
            <div className="space-y-2">
              <button onClick={handleResendVerification} disabled={loading}
                className="btn-ghost w-full text-sm">
                {loading ? 'Sending…' : 'Resend verification email'}
              </button>
              <button onClick={handleSkipToBilling}
                className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors py-2">
                Skip for now — set up billing
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Billing */}
        {step === 'billing' && (
          <div className="card p-6 space-y-5">
            <div className="text-3xl">💳</div>
            <h2 className="font-display text-xl font-bold text-white">Set up billing</h2>
            <p className="text-sm text-ink-400">
              Add a payment method so you're ready to book sessions instantly.
              We accept credit cards, Apple Pay, and Google Pay.
            </p>
            <div className="flex gap-3 text-2xl justify-center py-2">
              <span title="Visa">💳</span>
              <span title="Apple Pay">🍎</span>
              <span title="Google Pay">G</span>
            </div>
            <p className="text-xs text-ink-600 text-center">
              Secured by Stripe — your card details are never stored on our servers
            </p>
            <button onClick={handleSetupBilling} className="btn-primary w-full">
              Add payment method →
            </button>
            <button onClick={() => router.push('/customer/dashboard')}
              className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors py-2">
              Skip — I'll add billing later
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
TSH_EOF_MARKER


# ── Prisma schema additions ──────────────────────────────────────────────────
echo "→ patching prisma/schema.prisma (adding new AuthUser fields)"
# Add firstName, lastName, city, state, zip to AuthUser if not present
if ! grep -q "firstName" prisma/schema.prisma; then
python3 - << 'PYEOF'
import re, sys

schema = open('prisma/schema.prisma').read()
insert_after = '  phone            String?'
new_fields = '''  phone            String?
  firstName        String?
  lastName         String?
  city             String?
  state            String?
  zip              String?'''
schema = schema.replace(insert_after, new_fields, 1)
open('prisma/schema.prisma', 'w').write(schema)
print("  schema patched")
PYEOF
fi

if ! grep -q '"slug"' prisma/schema.prisma 2>/dev/null || ! grep -A5 'ExpertProfile' prisma/schema.prisma | grep -q 'slug'; then
python3 - << 'PYEOF'
import re

schema = open('prisma/schema.prisma').read()
insert_after = '  rejectionReason       String?'
new_fields = '''  rejectionReason       String?
  slug                  String?  @unique
  headline              String?
  publicBio             String?'''
schema = schema.replace(insert_after, new_fields, 1)
open('prisma/schema.prisma', 'w').write(schema)
print("  expertProfile slug fields added")
PYEOF
fi

# ── Shell nav update — add new admin routes ───────────────────────────────────
echo "→ adding Customers + Financials to admin nav in components/shell/Shell.tsx"
if ! grep -q "admin/customers" components/shell/Shell.tsx 2>/dev/null; then
  sed -i '' "s|{ href: '/admin/recordings',    label: 'Recordings',  icon: '◷' },|{ href: '/admin/recordings',    label: 'Recordings',  icon: '◷' },\n    { href: '/admin/customers',    label: 'Customers',   icon: '◍' },\n    { href: '/admin/financials',   label: 'Financials',  icon: '◉' },|" \
    components/shell/Shell.tsx 2>/dev/null || echo "  (manual nav update may be needed)"
fi

# ── Enable email verification in auth.ts ──────────────────────────────────────
echo "→ enabling email verification in lib/auth.ts"
sed -i '' 's/requireEmailVerification: false/requireEmailVerification: true/' lib/auth.ts 2>/dev/null || true

echo ""
echo "✓ Phase 2 applied. Next steps:"
echo ""
echo "  1. Run the Prisma migration:"
echo "     npx prisma migrate deploy"
echo ""
echo "  2. Add Stripe publishable key to Railway env vars:"
echo "     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_..."
echo ""
echo "  3. Enable Apple Pay & Google Pay in Stripe Dashboard:"
echo "     Dashboard → Settings → Payment methods"
echo ""
echo "  4. Commit and push:"
echo "     git add -A && git commit -m 'Phase 2: SEO, admin customers/financials, pro profiles, signup flow' && git push"
echo ""
echo "  5. Pros can generate their public link from /expert/profile"
echo "     Public URL format: https://tightspothelper.com/pro/their-slug"
