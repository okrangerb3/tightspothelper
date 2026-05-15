#!/usr/bin/env bash
# Expert availability, emergency rates, specialties
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

mkdir -p prisma/migrations/20260515000002_expert_availability
mkdir -p app/api/expert/profile

echo '→ writing migration'
cat > 'prisma/migrations/20260515000002_expert_availability/migration.sql' << 'TSH_EOF_MARKER'
-- Add availability schedule, emergency rates, and custom specialties to expert_profiles

ALTER TABLE "expert_profiles"
  -- Weekly schedule: {"mon":{"on":true,"start":"08:00","end":"18:00"}, "tue":{...}, ...}
  ADD COLUMN IF NOT EXISTS "weeklySchedule"     JSONB,
  -- Emergency settings
  ADD COLUMN IF NOT EXISTS "emergencyAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emergencyRate"      DECIMAL(10,2),
  -- Custom specialty tags the pro adds themselves (free-form strings)
  ADD COLUMN IF NOT EXISTS "specialties"        TEXT[] DEFAULT '{}',
  -- Timezone for their schedule
  ADD COLUMN IF NOT EXISTS "timezone"           TEXT DEFAULT 'America/Chicago';
TSH_EOF_MARKER

echo '→ writing app/(expert)/expert/profile/page.tsx'
cat > 'app/(expert)/expert/profile/page.tsx' << 'TSH_EOF_MARKER'
'use client'

import { useState, useEffect } from 'react'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tightspothelper.com'

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const HOURS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h
  return { value: `${String(h).padStart(2,'0')}:${m}`, label: `${h12}:${m} ${ampm}` }
})

const US_TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HT)' },
]

type DaySchedule = { on: boolean; start: string; end: string }
type WeeklySchedule = Record<string, DaySchedule>

const defaultSchedule = (): WeeklySchedule =>
  Object.fromEntries(DAYS.map(d => [
    d.key,
    { on: !['sat','sun'].includes(d.key), start: '08:00', end: '18:00' },
  ]))

interface Category { id: string; name: string; icon?: string }

export default function ExpertProfilePage() {
  const [tab, setTab] = useState<'profile'|'schedule'|'emergency'|'specialties'>('profile')

  // Profile fields
  const [form, setForm] = useState({
    bio: '', years: '', hourlyRate: 75, available: true,
  })

  // Schedule
  const [schedule, setSchedule]         = useState<WeeklySchedule>(defaultSchedule())
  const [timezone, setTimezone]         = useState('America/Chicago')

  // Emergency
  const [emergencyAvailable, setEmergencyAvailable] = useState(false)
  const [emergencyRate, setEmergencyRate]           = useState(150)

  // Specialties — custom tags + category selections
  const [categories, setCategories]     = useState<Category[]>([])
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [specialties, setSpecialties]   = useState<string[]>([])
  const [newSpecialty, setNewSpecialty] = useState('')

  // Public link
  const [slug, setSlug]     = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [genLoading, setGenLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/expert/profile').then(r => r.json()),
      fetch('/api/pro/slug').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([profile, slugData, catData]) => {
      if (profile) {
        setForm({
          bio:       profile.bio ?? '',
          years:     String(profile.yearsExperience ?? ''),
          hourlyRate: Number(profile.hourlyRate ?? 75),
          available:  profile.available ?? true,
        })
        if (profile.weeklySchedule) setSchedule(profile.weeklySchedule)
        if (profile.timezone)       setTimezone(profile.timezone)
        setEmergencyAvailable(profile.emergencyAvailable ?? false)
        setEmergencyRate(Number(profile.emergencyRate ?? 150))
        setSelectedCats(profile.categoryIds ?? [])
        setSpecialties(profile.specialties ?? [])
      }
      if (slugData.slug) setSlug(slugData.slug)
      setCategories(catData.categories ?? [])
      setLoading(false)
    })
  }, [])

  const updateDay = (day: string, patch: Partial<DaySchedule>) =>
    setSchedule(s => ({ ...s, [day]: { ...s[day], ...patch } }))

  const addSpecialty = () => {
    const val = newSpecialty.trim()
    if (!val || specialties.includes(val)) return
    setSpecialties(s => [...s, val])
    setNewSpecialty('')
  }

  const removeSpecialty = (s: string) =>
    setSpecialties(prev => prev.filter(x => x !== s))

  const toggleCat = (id: string) =>
    setSelectedCats(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const generateSlug = async () => {
    setGenLoading(true)
    const res  = await fetch('/api/pro/slug', { method: 'POST' })
    const data = await res.json()
    if (data.slug) setSlug(data.slug)
    setGenLoading(false)
  }

  const copyLink = () => {
    if (!slug) return
    navigator.clipboard.writeText(`${BASE_URL}/pro/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/expert/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio:                form.bio,
        yearsExperience:    parseInt(form.years) || 0,
        hourlyRate:         form.hourlyRate,
        available:          form.available,
        categoryIds:        selectedCats,
        specialties,
        weeklySchedule:     schedule,
        timezone,
        emergencyAvailable,
        emergencyRate:      emergencyAvailable ? emergencyRate : null,
      }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-ink-800 rounded-xl animate-pulse" />
      ))}
    </div>
  )

  const TABS = [
    { key: 'profile',    label: 'Profile' },
    { key: 'schedule',   label: 'Hours' },
    { key: 'emergency',  label: 'Emergency' },
    { key: 'specialties',label: 'Specialties' },
  ] as const

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-white">My profile</h1>
        <button onClick={save} disabled={saving}
          className={`btn-primary text-sm ${saved ? 'bg-green-600' : ''}`}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save all'}
        </button>
      </div>

      {/* Public link strip */}
      <div className="card p-4 mb-5 flex items-center gap-3">
        {slug ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-ink-500 mb-0.5">Your public link</p>
              <p className="text-xs text-white truncate">{BASE_URL}/pro/{slug}</p>
            </div>
            <button onClick={copyLink}
              className={`btn-ghost text-xs px-3 py-1.5 shrink-0 ${copied ? 'text-green-400 border-green-500/30' : ''}`}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <a href={`/pro/${slug}`} target="_blank" rel="noopener noreferrer"
              className="btn-ghost text-xs px-3 py-1.5 shrink-0">View</a>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-400 flex-1">No public link yet</p>
            <button onClick={generateSlug} disabled={genLoading} className="btn-primary text-xs px-3 py-1.5">
              {genLoading ? '…' : 'Generate link'}
            </button>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-ink-800 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors
              ${tab === t.key
                ? 'border-brand-500 text-white font-medium'
                : 'border-transparent text-ink-500 hover:text-ink-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ─────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between card p-4">
            <div>
              <p className="text-sm font-medium text-white">Available for sessions</p>
              <p className="text-xs text-ink-500">Customers can see and book you</p>
            </div>
            <button onClick={() => setForm(f => ({ ...f, available: !f.available }))}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0
                ${form.available ? 'bg-brand-500' : 'bg-ink-700'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${form.available ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <label className="label">Hourly rate · ${form.hourlyRate}/hr</label>
              <input type="range" min={25} max={500} step={5} value={form.hourlyRate}
                onChange={e => setForm(f => ({ ...f, hourlyRate: parseInt(e.target.value) }))}
                className="w-full mt-1" />
              <div className="flex justify-between text-xs text-ink-600 mt-1">
                <span>$25</span>
                <span className="text-brand-400 font-medium">${form.hourlyRate}/hr</span>
                <span>$500</span>
              </div>
              <p className="text-[10px] text-ink-600 mt-1">You set your own rate — platform fee is added on top for customers</p>
            </div>

            <div>
              <label className="label">Professional bio</label>
              <textarea className="input min-h-[100px] resize-none" value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Describe your expertise, experience, and what makes you great at this…" />
            </div>

            <div>
              <label className="label">Years of experience</label>
              <input type="number" className="input" value={form.years} min={0} max={60}
                onChange={e => setForm(f => ({ ...f, years: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE TAB ─────────────────────────────────────── */}
      {tab === 'schedule' && (
        <div className="space-y-4">
          <div className="card p-4">
            <label className="label">Your timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input">
              {US_TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-ink-800">
              <h2 className="font-display text-sm font-bold text-white">Weekly hours</h2>
              <p className="text-xs text-ink-500 mt-0.5">Customers can only book during your available hours</p>
            </div>
            <div className="divide-y divide-ink-800/60">
              {DAYS.map(day => {
                const d = schedule[day.key] ?? { on: false, start: '08:00', end: '18:00' }
                return (
                  <div key={day.key} className="flex items-center gap-3 px-4 py-3">
                    {/* Toggle */}
                    <button onClick={() => updateDay(day.key, { on: !d.on })}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0
                        ${d.on ? 'bg-brand-500' : 'bg-ink-700'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                        ${d.on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>

                    {/* Day name */}
                    <span className={`text-sm w-24 shrink-0 ${d.on ? 'text-white' : 'text-ink-600'}`}>
                      {day.label}
                    </span>

                    {/* Time selectors */}
                    {d.on ? (
                      <div className="flex items-center gap-2 flex-1">
                        <select value={d.start} onChange={e => updateDay(day.key, { start: e.target.value })}
                          className="input py-1.5 text-xs flex-1">
                          {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                        </select>
                        <span className="text-ink-600 text-xs shrink-0">to</span>
                        <select value={d.end} onChange={e => updateDay(day.key, { end: e.target.value })}
                          className="input py-1.5 text-xs flex-1">
                          {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-600">Unavailable</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EMERGENCY TAB ────────────────────────────────────── */}
      {tab === 'emergency' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Emergency / after-hours sessions</h2>
                <p className="text-xs text-ink-400 mt-1">
                  Accept urgent bookings outside your normal schedule at a higher rate.
                  Customers will see an emergency badge and the higher price.
                </p>
              </div>
              <button onClick={() => setEmergencyAvailable(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0
                  ${emergencyAvailable ? 'bg-brand-500' : 'bg-ink-700'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                  ${emergencyAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {emergencyAvailable && (
              <div className="space-y-4 pt-4 border-t border-ink-800">
                <div>
                  <label className="label">Emergency rate · ${emergencyRate}/hr</label>
                  <input type="range" min={50} max={1000} step={10} value={emergencyRate}
                    onChange={e => setEmergencyRate(parseInt(e.target.value))}
                    className="w-full mt-1" />
                  <div className="flex justify-between text-xs text-ink-600 mt-1">
                    <span>$50</span>
                    <span className="text-yellow-400 font-medium">${emergencyRate}/hr</span>
                    <span>$1,000</span>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm">
                  <p className="text-yellow-400 font-medium mb-1">🚨 How emergency sessions work</p>
                  <ul className="text-xs text-yellow-300/80 space-y-1">
                    <li>• Customers booking outside your schedule see the emergency rate</li>
                    <li>• You'll get a push notification — accept or decline within 10 min</li>
                    <li>• You can turn emergency availability off at any time</li>
                  </ul>
                </div>
              </div>
            )}

            {!emergencyAvailable && (
              <div className="bg-ink-800/50 rounded-xl p-4 text-xs text-ink-500 text-center">
                Enable emergency sessions to earn more on urgent after-hours calls
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SPECIALTIES TAB ──────────────────────────────────── */}
      {tab === 'specialties' && (
        <div className="space-y-5">
          {/* Category selection */}
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold text-white mb-1">Service categories</h2>
            <p className="text-xs text-ink-500 mb-4">Select all categories you offer — customers filter by these when booking</p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => toggleCat(cat.id)}
                  className={`p-3 rounded-xl border text-left text-sm transition-all
                    ${selectedCats.includes(cat.id)
                      ? 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-ink-700 text-ink-400 hover:border-ink-500'}`}>
                  {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom specialty tags */}
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold text-white mb-1">Custom specialties</h2>
            <p className="text-xs text-ink-500 mb-4">
              Add specific skills, brands, or techniques you specialize in.
              These appear on your public profile.
            </p>

            {/* Add new */}
            <div className="flex gap-2 mb-4">
              <input
                value={newSpecialty}
                onChange={e => setNewSpecialty(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSpecialty()}
                className="input flex-1 py-2"
                placeholder="e.g. Tankless water heaters, Kohler fixtures…"
              />
              <button onClick={addSpecialty} className="btn-primary px-4 py-2 text-sm shrink-0">
                Add
              </button>
            </div>

            {/* Tag list */}
            {specialties.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {specialties.map(s => (
                  <span key={s}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-800 border border-ink-700
                      rounded-full text-sm text-ink-200">
                    {s}
                    <button onClick={() => removeSpecialty(s)}
                      className="text-ink-500 hover:text-red-400 transition-colors leading-none ml-0.5">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-600 text-center py-4">
                No custom specialties yet — add yours above
              </p>
            )}

            {/* Suggestions */}
            <div className="mt-4 pt-4 border-t border-ink-800">
              <p className="text-[10px] text-ink-600 mb-2 uppercase tracking-wide">Common examples</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Leak detection','PEX piping','Sump pumps','Water softeners',
                  'EV charger install','Smart home wiring','Panel upgrades',
                  'Mini-split systems','Ductless HVAC','Heat pumps',
                  'Garage doors','Deck repair','Tile work',
                ].filter(s => !specialties.includes(s)).slice(0, 8).map(s => (
                  <button key={s} onClick={() => setSpecialties(prev => [...prev, s])}
                    className="text-xs px-2.5 py-1 rounded-full border border-ink-700 text-ink-500
                      hover:border-brand-500/50 hover:text-ink-300 transition-colors">
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
TSH_EOF_MARKER

echo '→ writing app/api/expert/profile/route.ts'
cat > 'app/api/expert/profile/route.ts' << 'TSH_EOF_MARKER'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const profile = await prisma.expertProfile.findUnique({
    where: { id: session.user.id },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    bio:                  profile.bio,
    yearsExperience:      profile.yearsExperience,
    certifications:       profile.certifications,
    hourlyRate:           profile.hourlyRate,
    categoryIds:          profile.categoryIds,
    available:            profile.available,
    weeklySchedule:       (profile as any).weeklySchedule ?? null,
    timezone:             (profile as any).timezone ?? 'America/Chicago',
    emergencyAvailable:   (profile as any).emergencyAvailable ?? false,
    emergencyRate:        (profile as any).emergencyRate ?? null,
    specialties:          (profile as any).specialties ?? [],
    slug:                 (profile as any).slug ?? null,
    headline:             (profile as any).headline ?? null,
    publicBio:            (profile as any).publicBio ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const {
    bio, yearsExperience, certifications, hourlyRate, categoryIds,
    available, weeklySchedule, timezone, emergencyAvailable, emergencyRate,
    specialties, headline, publicBio,
  } = body

  await prisma.expertProfile.update({
    where: { id: session.user.id },
    data: {
      ...(bio              !== undefined ? { bio }              : {}),
      ...(yearsExperience  !== undefined ? { yearsExperience }  : {}),
      ...(certifications   !== undefined ? { certifications }   : {}),
      ...(hourlyRate       !== undefined ? { hourlyRate }       : {}),
      ...(categoryIds      !== undefined ? { categoryIds }      : {}),
      ...(available        !== undefined ? { available }        : {}),
      // New fields stored as JSON/raw until schema is updated
      ...(weeklySchedule   !== undefined ? { weeklySchedule }   : {}),
      ...(timezone         !== undefined ? { timezone }         : {}),
      ...(emergencyAvailable !== undefined ? { emergencyAvailable } : {}),
      ...(emergencyRate    !== undefined ? { emergencyRate }    : {}),
      ...(specialties      !== undefined ? { specialties }      : {}),
      ...(headline         !== undefined ? { headline }         : {}),
      ...(publicBio        !== undefined ? { publicBio }        : {}),
    } as any,
  })

  return NextResponse.json({ ok: true })
}
TSH_EOF_MARKER


# Patch prisma/schema.prisma — add new fields to ExpertProfile
echo "→ patching prisma/schema.prisma"
if ! grep -q "weeklySchedule" prisma/schema.prisma; then
python3 - << 'PYEOF'
schema = open('prisma/schema.prisma').read()
insert_after = '  slug                  String?  @unique'
new_fields = '''  slug                  String?  @unique
  headline              String?
  publicBio             String?
  weeklySchedule        Json?
  timezone              String?  @default("America/Chicago")
  emergencyAvailable    Boolean  @default(false)
  emergencyRate         Decimal? @db.Decimal(10, 2)
  specialties           String[]'''
schema = schema.replace(insert_after, new_fields, 1)
open('prisma/schema.prisma', 'w').write(schema)
print("  schema patched with availability fields")
PYEOF
fi

echo ""
echo "✓ Applied. Now run:"
echo "  git add -A && git commit -m 'Expert availability, emergency rates, specialties' && git push"
