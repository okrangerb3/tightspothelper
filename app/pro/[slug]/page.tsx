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
