'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Category { name: string; slug: string; icon?: string | null }

interface Pro {
  id: string; name: string; image: string | null; bio: string | null
  headline: string | null; hourlyRate: number; ratingAvg: number
  ratingCount: number; yearsExperience: number | null; available: boolean
  certifications: string[]; specialties: string[]; emergencyAvailable: boolean
  emergencyRate: number; slug: string
  status: string
}

interface Props { pro: Pro; categories: Category[]; baseUrl: string }

export default function ProPublicProfileClient({ pro, categories, baseUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const initials = pro.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const publicUrl = `${baseUrl}/pro/${pro.slug}`

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Nav */}
      <nav className="border-b border-ink-800 px-4 sm:px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="font-display font-bold text-white text-base">
          TightSpot<span className="text-brand-500">Helper</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/login"  className="btn-ghost text-sm py-2 px-3">Log in</Link>
          <Link href="/signup" className="btn-primary text-sm py-2 px-3">Get help</Link>
        </div>
      </nav>

      {pro.status !== 'approved' && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 text-center">
          <p className="text-xs text-yellow-400">
            👁 Preview — this profile is only visible to you until approved by TightSpotHelper
          </p>
        </div>
      )}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* Hero card */}
        <div className="card p-6">
          <div className="flex items-start gap-4">
            {pro.image ? (
              <img src={pro.image} alt={pro.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-500/20 border border-brand-500/30
                flex items-center justify-center text-xl font-bold text-brand-400 shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{pro.name}</h1>
              {pro.headline && <p className="text-ink-400 text-sm mt-0.5">{pro.headline}</p>}

              <div className="flex flex-wrap items-center gap-3 mt-2">
                {pro.ratingAvg > 0 && (
                  <span className="text-sm text-yellow-400">
                    ★ {pro.ratingAvg.toFixed(1)}
                    <span className="text-ink-500 text-xs ml-1">({pro.ratingCount})</span>
                  </span>
                )}
                {pro.hourlyRate > 0 && (
                  <span className="text-sm font-medium text-brand-400">${pro.hourlyRate}/hr</span>
                )}
                {pro.emergencyAvailable && pro.emergencyRate > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    🚨 Emergency ${pro.emergencyRate}/hr
                  </span>
                )}
                {pro.yearsExperience && (
                  <span className="text-xs text-ink-500">{pro.yearsExperience} yrs exp</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border
                  ${pro.available
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-ink-800 text-ink-500 border-ink-700'}`}>
                  {pro.available ? '● Available' : '○ Unavailable'}
                </span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            {pro.available && (
              <Link href={`/signup?bookPro=${pro.id}`} className="btn-primary flex-1 text-center">
                Book a session
              </Link>
            )}
            <button onClick={copyLink}
              className={`btn-ghost flex-1 text-sm transition-colors
                ${copied ? 'text-green-400 border-green-500/30' : ''}`}>
              {copied ? '✓ Link copied!' : '🔗 Share this profile'}
            </button>
          </div>
        </div>

        {/* About */}
        {pro.bio && (
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold text-white mb-3">About</h2>
            <p className="text-ink-300 text-sm leading-relaxed whitespace-pre-line">{pro.bio}</p>
          </div>
        )}

        {/* Specialties */}
        {(categories.length > 0 || pro.specialties.length > 0) && (
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold text-white mb-3">Specialties</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <span key={c.slug}
                  className="px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-sm text-brand-300">
                  {c.icon && <span className="mr-1.5">{c.icon}</span>}{c.name}
                </span>
              ))}
              {pro.specialties.map(s => (
                <span key={s}
                  className="px-3 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-sm text-ink-300">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {pro.certifications.length > 0 && (
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold text-white mb-3">Certifications</h2>
            <ul className="space-y-2">
              {pro.certifications.map((cert, i) => (
                <li key={i} className="text-sm text-ink-300 flex items-center gap-2">
                  <span className="text-brand-400 shrink-0">✓</span> {cert}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Emergency availability */}
        {pro.emergencyAvailable && (
          <div className="card p-5 border-yellow-500/20">
            <h2 className="font-display text-sm font-bold text-white mb-2">🚨 Emergency sessions</h2>
            <p className="text-sm text-ink-300">
              {pro.name.split(' ')[0]} accepts urgent after-hours sessions at ${pro.emergencyRate}/hr.
              Book now and they'll respond within 10 minutes.
            </p>
            {pro.available && (
              <Link href={`/signup?bookPro=${pro.id}&emergency=1`}
                className="btn-primary w-full text-center mt-4 block text-sm">
                Request emergency session
              </Link>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
